import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { EventEmitter } from 'events';
import { IncidentAnalysis, Incident, TimelineEvent } from '../types';
import { TIMELINE_QUERY, HERO_QUERY } from './queries';
import { SEED_ANALYSIS, SEED_INCIDENTS, SEED_TIMELINE } from '../seed/data';

const execAsync = promisify(exec);

export interface CoralQueryEvent {
  id: string;
  timestamp: string;
  sql: string;
  source: string;
  rows: number;
  duration_ms: number;
  status: 'ok' | 'error' | 'seed';
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
  if (lower.includes('sentry.')) return 'sentry';
  if (lower.includes('launchdarkly.') || lower.includes('feature_flags')) return 'launchdarkly';
  if (lower.includes('github.')) return 'github';
  if (lower.includes('slack.')) return 'slack';
  if (lower.includes('stripe.')) return 'stripe';
  if (lower.includes('intercom.')) return 'intercom';
  return 'coral';
}

function emit(event: CoralQueryEvent) {
  RECENT_ACTIVITY.unshift(event);
  if (RECENT_ACTIVITY.length > MAX_ACTIVITY) RECENT_ACTIVITY.pop();
  coralActivityBus.emit('query', event);
}

export class CoralClient {
  async query(sql: string): Promise<Record<string, unknown>[]> {
    const source = inferSource(sql);
    const start = Date.now();
    const id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const tmpFile = join(tmpdir(), `coral_${Date.now()}.sql`);
    try {
      writeFileSync(tmpFile, sql, 'utf8');
      const { stdout } = await execAsync(`coral sql --format json --file "${tmpFile}"`, {
        timeout: 30000
      });
      unlinkSync(tmpFile);

      if (!stdout.trim()) {
        emit({ id, timestamp: new Date().toISOString(), sql, source, rows: 0, duration_ms: Date.now() - start, status: 'ok' });
        return [];
      }
      try {
        const parsed = JSON.parse(stdout);
        const rows = Array.isArray(parsed) ? parsed : [parsed];
        emit({ id, timestamp: new Date().toISOString(), sql, source, rows: rows.length, duration_ms: Date.now() - start, status: 'ok' });
        return rows;
      } catch {
        const rows = stdout.split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
        emit({ id, timestamp: new Date().toISOString(), sql, source, rows: rows.length, duration_ms: Date.now() - start, status: 'ok' });
        return rows;
      }
    } catch (error: unknown) {
      try { unlinkSync(tmpFile); } catch { /* ignore */ }
      const msg = error instanceof Error ? error.message : String(error);
      emit({ id, timestamp: new Date().toISOString(), sql, source, rows: 0, duration_ms: Date.now() - start, status: 'error', error: msg });
      throw new Error(`Coral query failed: ${msg}`);
    }
  }

  async runIncidentQuery(incidentId: string): Promise<IncidentAnalysis> {
    const rows = await this.query(TIMELINE_QUERY);
    if (rows.length === 0) return { ...SEED_ANALYSIS, incidentId, timeline: [], sources_queried: [] };
    return this.mapRowsToAnalysis(incidentId, rows);
  }

  async getLiveIncidents(): Promise<Incident[]> {
    try {
      const rows = await this.query(HERO_QUERY);
      if (rows.length === 0) return [];
      return []; // hero query returns aggregate, map to incidents when Coral schema is known
    } catch {
      return [];
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
