import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const churnRouter = Router();
const coral = new CoralClient();

interface ChurnCustomer {
  customer_id: string;
  name: string;
  mrr: number;
  recent_tickets: number;
  active_errors: number;
  risk: number;
  label: string;
}

const SEED_DATA: ChurnCustomer[] = [
  { customer_id: 'cus_001', name: 'Acme Corp', mrr: 8400, recent_tickets: 0, active_errors: 847, risk: 94, label: 'Silent — high churn risk' },
  { customer_id: 'cus_002', name: 'Globex Inc', mrr: 6200, recent_tickets: 4, active_errors: 23, risk: 41, label: 'Engaged — monitor' },
  { customer_id: 'cus_003', name: 'Initech LLC', mrr: 3100, recent_tickets: 12, active_errors: 2, risk: 8, label: 'Healthy' },
];

function scoreLabel(risk: number): string {
  if (risk >= 70) return 'Silent — high churn risk';
  if (risk >= 30) return 'Engaged — monitor';
  return 'Healthy';
}

// GET /api/churn
churnRouter.get('/', async (_req: Request, res: Response) => {
  try {
    const rows = await coral.query(
      `SELECT
        c.id as customer_id,
        c.name,
        c.mrr,
        COUNT(DISTINCT i.id) as recent_tickets,
        COUNT(DISTINCT e.id) as active_errors
       FROM stripe.customers c
       LEFT JOIN intercom.tickets i
         ON c.customer_id = i.customer_id
         AND i.created_at > NOW() - INTERVAL '7 days'
       LEFT JOIN sentry.issues e
         ON e.status = 'unresolved'
       WHERE c.plan = 'enterprise'
       GROUP BY c.id, c.name, c.mrr
       ORDER BY active_errors DESC, recent_tickets ASC
       LIMIT 10`
    );

    if (!rows.length) return res.json([]);

    const MAX_ERRORS = Math.max(...rows.map(r => Number((r as Record<string, unknown>).active_errors ?? 0)), 1);

    const customers: ChurnCustomer[] = rows.map(r => {
      const row = r as Record<string, unknown>;
      const active_errors = Number(row.active_errors ?? 0);
      const recent_tickets = Number(row.recent_tickets ?? 0);
      const errorScore = Math.min(60, (active_errors / MAX_ERRORS) * 60);
      const silenceScore = recent_tickets === 0 && active_errors > 5 ? 40 : 0;
      const risk = Math.round(errorScore + silenceScore);
      return {
        customer_id: String(row.customer_id ?? ''),
        name: String(row.name ?? ''),
        mrr: Number(row.mrr ?? 0),
        recent_tickets,
        active_errors,
        risk,
        label: scoreLabel(risk),
      };
    });

    return res.json(customers);
  } catch {
    return res.json([]);
  }
});
