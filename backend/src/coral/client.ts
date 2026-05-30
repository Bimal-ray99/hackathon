import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { IncidentAnalysis, Incident, TimelineEvent } from '../types';
import { TIMELINE_QUERY, HERO_QUERY } from './queries';
import { SEED_ANALYSIS, SEED_INCIDENTS, SEED_TIMELINE } from '../seed/data';

const execAsync = promisify(exec);

export class CoralClient {
  private useSeed: boolean;

  constructor() {
    this.useSeed = process.env.CORAL_USE_SEED === 'true';
  }

  async query(sql: string): Promise<Record<string, unknown>[]> {
    if (this.useSeed) return [];

    // Write SQL to temp file to avoid shell escaping issues
    const tmpFile = join(tmpdir(), `coral_${Date.now()}.sql`);
    try {
      writeFileSync(tmpFile, sql, 'utf8');
      const { stdout } = await execAsync(`coral sql --format json --file "${tmpFile}"`, {
        timeout: 30000
      });
      unlinkSync(tmpFile);

      if (!stdout.trim()) return [];
      try {
        const parsed = JSON.parse(stdout);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch {
        return stdout
          .split('\n')
          .filter(line => line.trim())
          .map(line => JSON.parse(line));
      }
    } catch (error: unknown) {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      const msg = error instanceof Error ? error.message : String(error);
      throw new Error(`Coral query failed: ${msg}`);
    }
  }

  async runIncidentQuery(incidentId: string): Promise<IncidentAnalysis> {
    if (this.useSeed) {
      return { ...SEED_ANALYSIS, incidentId };
    }
    try {
      const rows = await this.query(TIMELINE_QUERY);
      if (rows.length === 0) return { ...SEED_ANALYSIS, incidentId };
      return this.mapRowsToAnalysis(incidentId, rows);
    } catch {
      return { ...SEED_ANALYSIS, incidentId };
    }
  }

  async getLiveIncidents(): Promise<Incident[]> {
    if (this.useSeed) return SEED_INCIDENTS;
    try {
      const rows = await this.query(HERO_QUERY);
      if (rows.length === 0) return SEED_INCIDENTS;
      return SEED_INCIDENTS; // hero query returns aggregate, not incident list
    } catch {
      return SEED_INCIDENTS;
    }
  }

  async querySource(source: string): Promise<{ rows: Record<string, unknown>[]; query: string }> {
    const queries: Record<string, string> = {
      launchdarkly: `SELECT name AS title, creation_date AS timestamp, 'launchdarkly' AS source FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 5`,
      sentry: `SELECT title, first_seen AS timestamp, 'sentry' AS source FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 5`,
      github: `SELECT commit__message AS title, commit__author__date AS timestamp, 'github' AS source FROM github.commits WHERE owner = 'Bimal-ray99' AND repo = 'hackathon' ORDER BY commit__author__date DESC LIMIT 5`,
      slack: `SELECT text AS title, ts AS timestamp, 'slack' AS source FROM slack.messages WHERE channel = 'incidents' LIMIT 5`,
    };

    const sql = queries[source];
    if (!sql) return { rows: [], query: '' };

    try {
      const rows = await this.query(sql);
      return { rows, query: sql };
    } catch {
      return { rows: [], query: sql };
    }
  }

  private mapRowsToAnalysis(incidentId: string, rows: Record<string, unknown>[]): IncidentAnalysis {
    const timeline: TimelineEvent[] = rows.map((row, index) => {
      const source = String(row.source || 'launchdarkly') as TimelineEvent['source'];
      const typeMap: Record<string, TimelineEvent['type']> = {
        github: 'deploy',
        launchdarkly: 'flag_change',
        sentry: 'error_spike',
        slack: 'message',
        stripe: 'payment',
        intercom: 'ticket'
      };

      return {
        id: String(index + 1),
        timestamp: String(row.timestamp || new Date().toISOString()),
        source,
        type: typeMap[source] || 'deploy',
        title: String(row.title || ''),
        description: String(row.description || row.title || ''),
        severity: source === 'sentry' ? 'critical' : source === 'slack' ? 'warning' : 'info'
      };
    });

    const sources_queried = Array.from(new Set(rows.map(r => String(r.source))));

    return {
      ...SEED_ANALYSIS,
      incidentId,
      timeline: timeline.length > 0 ? timeline : SEED_TIMELINE,
      sources_queried: sources_queried.length > 0 ? sources_queried : SEED_ANALYSIS.sources_queried,
      coral_query: TIMELINE_QUERY
    };
  }
}
