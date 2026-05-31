import { exec } from "child_process";
import { promisify } from "util";
import { EventEmitter } from "events";
import {
  IncidentAnalysis,
  Incident,
  TimelineEvent,
  AffectedCustomer,
} from "../types";
import { TIMELINE_QUERY } from "./queries";

const execAsync = promisify(exec);

export interface CoralQueryEvent {
  id: string;
  timestamp: string;
  sql: string;
  source: string;
  rows: number;
  duration_ms: number;
  status: "ok" | "error" | "seed";
  error?: string;
}

export const coralActivityBus = new EventEmitter();
coralActivityBus.setMaxListeners(50);

const RECENT_ACTIVITY: CoralQueryEvent[] = [];
const MAX_ACTIVITY = 50;

export function getRecentActivity(): CoralQueryEvent[] {
  return [...RECENT_ACTIVITY];
}

function inferSource(sql: string): string {
  const lower = sql.toLowerCase();
  if (lower.includes("sentry.")) return "sentry";
  if (lower.includes("launchdarkly.") || lower.includes("feature_flags"))
    return "launchdarkly";
  if (lower.includes("github.")) return "github";
  if (lower.includes("slack.")) return "slack";
  if (lower.includes("stripe.")) return "stripe";
  if (lower.includes("intercom.")) return "intercom";
  return "coral";
}

function emit(event: CoralQueryEvent) {
  RECENT_ACTIVITY.unshift(event);
  if (RECENT_ACTIVITY.length > MAX_ACTIVITY) RECENT_ACTIVITY.pop();
  coralActivityBus.emit("query", event);
}

// Parse coral table output: "| col1 | col2 |" rows → array of objects
function parseCoralOutput(stdout: string): Record<string, unknown>[] {
  if (!stdout.trim()) return [];

  // Try JSON first (some coral versions support it)
  try {
    const parsed = JSON.parse(stdout.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    /* not JSON, try table */
  }

  // Try NDJSON (one JSON object per line)
  const lines = stdout
    .trim()
    .split("\n")
    .filter((l) => l.trim());
  if (lines[0]?.trim().startsWith("{")) {
    try {
      return lines.map((l) => JSON.parse(l));
    } catch {
      /* not NDJSON */
    }
  }

  // Parse pipe-separated table: | col | col |
  const tableLines = lines.filter((l) => l.includes("|"));
  if (tableLines.length < 2) return [];

  // First pipe line = headers
  const headers = tableLines[0]
    .split("|")
    .map((h) => h.trim())
    .filter((h) => h.length > 0);

  if (headers.length === 0) return [];

  // Skip separator lines (contain only dashes/pluses)
  const dataLines = tableLines.slice(1).filter((l) => !/^[\s|+\-]+$/.test(l));

  return dataLines.map((line) => {
    const values = line
      .split("|")
      .map((v) => v.trim())
      .filter((_, i, arr) => i > 0 && i < arr.length - 1); // strip first/last empty
    const obj: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      const val = values[i] ?? "";
      obj[h] = isNaN(Number(val)) || val === "" ? val : Number(val);
    });
    return obj;
  });
}

export class CoralClient {
  async query(sql: string): Promise<Record<string, unknown>[]> {
    const source = inferSource(sql);
    const start = Date.now();
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const escaped = sql.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const cmd = `coral sql --format json "${escaped}"`;
    console.log(`[coral] CMD: ${cmd.slice(0, 300)}`);
    try {
      const { stdout, stderr } = await execAsync(cmd, { timeout: 30000 });
      console.log(
        `[coral] STDOUT (${stdout.length} chars): ${stdout.slice(0, 500)}`,
      );
      if (stderr) console.log(`[coral] STDERR: ${stderr.slice(0, 300)}`);

      const rows = parseCoralOutput(stdout);
      console.log(
        `[coral] PARSED ${rows.length} rows. First:`,
        rows[0] ?? "none",
      );
      emit({
        id,
        timestamp: new Date().toISOString(),
        sql,
        source,
        rows: rows.length,
        duration_ms: Date.now() - start,
        status: "ok",
      });
      return rows;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error(`[coral] ERROR: ${msg.slice(0, 500)}`);
      emit({
        id,
        timestamp: new Date().toISOString(),
        sql,
        source,
        rows: 0,
        duration_ms: Date.now() - start,
        status: "error",
        error: msg,
      });
      throw new Error(`Coral query failed: ${msg}`);
    }
  }

  async runIncidentQuery(incidentId: string): Promise<IncidentAnalysis> {
    const rows = await this.query(TIMELINE_QUERY);
    return this.mapRowsToAnalysis(incidentId, rows);
  }

  async getLiveIncidents(): Promise<Incident[]> {
    try {
      const rows = await this.query(
        `SELECT id, title, status, first_seen, last_seen, count
         FROM sentry.issues
         WHERE status = 'unresolved'
         ORDER BY first_seen DESC
         LIMIT 10`,
      );
      console.log(
        `[getLiveIncidents] got ${rows.length} rows:`,
        JSON.stringify(rows).slice(0, 400),
      );
      if (rows.length === 0) return [];

      return rows.map((r, i) => {
        const row = r as Record<string, unknown>;
        const timesSeenNum = Number(row.count ?? 1);
        return {
          id: `sentry-${String(row.id ?? i + 1)}`,
          title: String(row.title ?? "Unknown error"),
          status: "active" as const,
          severity: (timesSeenNum > 100
            ? "P0"
            : timesSeenNum > 20
              ? "P1"
              : "P2") as "P0" | "P1" | "P2",
          started_at: String(row.first_seen ?? new Date().toISOString()),
          mrr_at_risk: 0,
          affected_customers: 0,
        } satisfies Incident;
      });
    } catch (e) {
      console.error(
        "[getLiveIncidents] CATCH:",
        e instanceof Error ? e.message : String(e),
      );
      return [];
    }
  }

  async querySource(
    source: string,
  ): Promise<{ rows: Record<string, unknown>[]; query: string }> {
    const queries: Record<string, string> = {
      launchdarkly: `SELECT name AS title, creation_date AS timestamp, 'launchdarkly' AS source FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 5`,
      sentry: `SELECT title, first_seen AS timestamp, 'sentry' AS source FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 5`,
      github: `SELECT commit__message AS title, commit__author__date AS timestamp, 'github' AS source FROM github.commits ORDER BY commit__author__date DESC LIMIT 5`,
      slack: `SELECT text AS title, ts AS timestamp, 'slack' AS source FROM slack.messages WHERE channel = 'incidents' LIMIT 5`,
    };

    const sql = queries[source];
    if (!sql) return { rows: [], query: "" };

    try {
      const rows = await this.query(sql);
      return { rows, query: sql };
    } catch {
      return { rows: [], query: sql };
    }
  }

  private mapRowsToAnalysis(
    incidentId: string,
    rows: Record<string, unknown>[],
  ): IncidentAnalysis {
    const timeline: TimelineEvent[] = rows.map((row, index) => {
      const source = String(
        row.source || "launchdarkly",
      ) as TimelineEvent["source"];
      const typeMap: Record<string, TimelineEvent["type"]> = {
        github: "deploy",
        launchdarkly: "flag_change",
        sentry: "error_spike",
        slack: "message",
        stripe: "payment",
        intercom: "ticket",
      };

      return {
        id: String(index + 1),
        timestamp: String(row.timestamp || new Date().toISOString()),
        source,
        type: typeMap[source] || "deploy",
        title: String(row.title || ""),
        description: String(row.description || row.title || ""),
        severity:
          source === "sentry"
            ? "critical"
            : source === "slack"
              ? "warning"
              : "info",
      };
    });

    const sources_queried = Array.from(
      new Set(rows.map((r) => String(r.source))),
    );

    return {
      incidentId,
      summary: "",
      root_cause: "",
      recommended_action: "",
      confidence: "low" as const,
      mrr_at_risk: 0,
      affected_customers: [] as AffectedCustomer[],
      support_ticket_count: 0,
      timeline,
      sources_queried,
      coral_query: TIMELINE_QUERY,
    };
  }
}
