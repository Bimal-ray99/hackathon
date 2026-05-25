import { SEED_ANALYSIS } from '../seed/data';
import { IncidentAnalysis } from '../types';
import { HERO_QUERY } from './queries';

export class CoralClient {
  private useSeed: boolean;

  constructor() {
    this.useSeed = process.env.CORAL_USE_SEED === 'true' || !process.env.CORAL_API_URL;
  }

  async query(sql: string): Promise<Record<string, unknown>[]> {
    if (this.useSeed) {
      return this.seedQuery(sql);
    }
    const res = await fetch(`${process.env.CORAL_API_URL}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql })
    });
    if (!res.ok) throw new Error(`Coral query failed: ${res.statusText}`);
    return res.json() as Promise<Record<string, unknown>[]>;
  }

  async runIncidentQuery(incidentId: string): Promise<IncidentAnalysis> {
    if (this.useSeed) {
      return { ...SEED_ANALYSIS, incidentId, coral_query: HERO_QUERY };
    }
    const rows = await this.query(HERO_QUERY);
    return this.mapRowsToAnalysis(incidentId, rows);
  }

  private seedQuery(_sql: string): Record<string, unknown>[] {
    return [
      {
        flag_name: 'new-upload-flow',
        enabled_at: '2026-05-15T10:02:00Z',
        error_count: 847,
        affected_customers: 12,
        mrr_at_risk: 35200,
        support_tickets: 8
      }
    ];
  }

  private mapRowsToAnalysis(
    incidentId: string,
    rows: Record<string, unknown>[]
  ): IncidentAnalysis {
    const row = rows[0] || {};
    return {
      ...SEED_ANALYSIS,
      incidentId,
      mrr_at_risk: Number(row.mrr_at_risk) || 0,
      support_ticket_count: Number(row.support_tickets) || 0,
      coral_query: HERO_QUERY
    };
  }
}
