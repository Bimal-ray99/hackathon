import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const noiseRouter = Router();
const coral = new CoralClient();

interface NoiseScore {
  alert_id: string;
  title: string;
  score: number;
  signals: string[];
}

const SEED_SCORES: NoiseScore[] = [
  { alert_id: 'alert-1', title: 'TypeError in upload-handler', score: 100, signals: ['Enterprise customer', 'Active ticket', 'No GitHub issue'] },
  { alert_id: 'alert-2', title: 'Auth latency spike', score: 40, signals: ['Enterprise customer'] },
  { alert_id: 'alert-3', title: 'Dashboard timeout', score: 25, signals: ['No GitHub issue'] },
  { alert_id: 'alert-4', title: 'Rate limit exceeded', score: 0, signals: [] },
];

// GET /api/noise/scores
noiseRouter.get('/scores', async (_req: Request, res: Response) => {
  try {
    const issues = await coral.query(
      `SELECT id, title, level, project FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 10`
    );

    if (!issues.length) return res.json([]);

    const scored: NoiseScore[] = await Promise.all(
      issues.map(async (issue, idx) => {
        const row = issue as Record<string, unknown>;
        const issueId = String(row.id ?? '');
        const title = String(row.title ?? '');
        const signals: string[] = [];
        let score = 0;

        try {
          const stripeRows = await coral.query(
            `SELECT plan FROM stripe.customers WHERE customer_id = '${issueId}' LIMIT 1`
          );
          if ((stripeRows[0] as Record<string, unknown>)?.plan === 'enterprise') {
            score += 40;
            signals.push('Enterprise customer');
          }
        } catch { /* skip */ }

        try {
          const ticketRows = await coral.query(
            `SELECT COUNT(*) as count FROM intercom.tickets WHERE customer_id = '${issueId}' AND created_at > NOW() - INTERVAL '24 hours'`
          );
          if (Number((ticketRows[0] as Record<string, unknown>)?.count ?? 0) > 0) {
            score += 35;
            signals.push('Active ticket');
          }
        } catch { /* skip */ }

        try {
          const fragment = title.split(':')[0].trim().toLowerCase().replace(/\s+/g, '+');
          const ghRows = await coral.query(
            `SELECT COUNT(*) as count FROM github.issues WHERE state = 'open' AND title ILIKE '%${fragment}%'`
          );
          if (Number((ghRows[0] as Record<string, unknown>)?.count ?? 0) === 0) {
            score += 25;
            signals.push('No GitHub issue');
          }
        } catch { /* skip */ }

        return {
          alert_id: `alert-${idx + 1}`,
          title,
          score,
          signals,
        };
      })
    );

    return res.json(scored.sort((a, b) => b.score - a.score));
  } catch {
    return res.json([]);
  }
});
