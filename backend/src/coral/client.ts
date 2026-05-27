import { exec } from 'child_process';
import { promisify } from 'util';
import { IncidentAnalysis } from '../types';
import { TIMELINE_QUERY } from './queries';

const execAsync = promisify(exec);

export class CoralClient {
  async query(sql: string): Promise<Record<string, unknown>[]> {
    try {
      // Execute coral CLI command directly
      // Escape the double quotes in SQL if necessary, or pass via stdin if it was complex,
      // but for this simple query we can just wrap in quotes.
      const command = `coral sql --format json "${sql.replace(/"/g, '\\"')}"`;
      const { stdout } = await execAsync(command);
      
      // The CLI output should be JSON lines or a JSON array depending on Coral's implementation.
      // Usually, CLIs returning JSON return an array or newline separated objects.
      try {
        const parsed = JSON.parse(stdout);
        return Array.isArray(parsed) ? parsed : [parsed];
      } catch (e) {
        // Fallback for jsonlines
        return stdout
          .split('\n')
          .filter((line) => line.trim())
          .map((line) => JSON.parse(line));
      }
    } catch (error: any) {
      throw new Error(`Coral query failed: ${error.message}`);
    }
  }

  async runIncidentQuery(incidentId: string): Promise<IncidentAnalysis> {
    const rows = await this.query(TIMELINE_QUERY);
    return this.mapRowsToAnalysis(incidentId, rows);
  }

  private mapRowsToAnalysis(
    incidentId: string,
    rows: Record<string, unknown>[]
  ): IncidentAnalysis {
    const timeline = rows.map((row, index) => {
      const source = String(row.source) as 'github' | 'launchdarkly' | 'sentry' | 'slack' | 'stripe' | 'intercom';
      let description = '';
      let type: 'deploy' | 'flag_change' | 'error_spike' | 'message' | 'payment' | 'ticket' | any = 'deploy';

      if (source === 'github') {
        type = 'deploy';
        description = `Commit: ${row.title}`;
      } else if (source === 'launchdarkly') {
        type = 'flag_change';
        description = `Flag ${row.title} was changed`;
      } else if (source === 'sentry') {
        type = 'error_spike';
        description = `Sentry Issue: ${row.title}`;
      }

      return {
        id: String(index + 1),
        timestamp: String(row.timestamp),
        source,
        type,
        title: String(row.title),
        description
      };
    });

    const sources_queried = Array.from(new Set(rows.map(r => String(r.source))));

    return {
      incidentId,
      summary: '',
      root_cause: '',
      recommended_action: '',
      confidence: 'low',
      mrr_at_risk: 0,
      support_ticket_count: 0,
      affected_customers: [],
      sources_queried: sources_queried.length > 0 ? sources_queried : ['launchdarkly', 'github'],
      timeline,
      coral_query: TIMELINE_QUERY
    };
  }
}
