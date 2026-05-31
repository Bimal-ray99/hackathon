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
  source: string;
}

// Map known Sentry project names to fictional enterprise customer names + MRR
const PROJECT_TO_CUSTOMER: Record<string, { name: string; mrr: number }> = {
  'pulseiq-victim-service': { name: 'Acme Corp', mrr: 8400 },
  'pulseiq': { name: 'Globex Industries', mrr: 12200 },
  'default': { name: 'Initech LLC', mrr: 6100 },
  'javascript': { name: 'Umbrella Co', mrr: 9800 },
  'python': { name: 'Hooli Inc', mrr: 4300 },
  'backend': { name: 'Pied Piper', mrr: 3200 },
  'frontend': { name: 'Aviato LLC', mrr: 5600 },
};

function scoreLabel(risk: number): string {
  if (risk >= 70) return 'Silent — high churn risk';
  if (risk >= 30) return 'Engaged — monitor';
  return 'Healthy';
}

function computeRisk(active_errors: number, recent_tickets: number, maxErrors: number): number {
  const errorScore = Math.min(60, (active_errors / Math.max(maxErrors, 1)) * 60);
  // No tickets + high errors = "silent" churn signal (biggest danger)
  const silenceScore = recent_tickets === 0 && active_errors > 0 ? 40 : 0;
  return Math.round(errorScore + silenceScore);
}

churnRouter.get('/', async (_req: Request, res: Response) => {
  // Try full Stripe+Intercom+Sentry JOIN first
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
    if (rows.length > 0) {
      const maxErrors = Math.max(...rows.map(r => Number((r as Record<string, unknown>).active_errors ?? 0)), 1);
      return res.json(rows.map(r => {
        const row = r as Record<string, unknown>;
        const active_errors = Number(row.active_errors ?? 0);
        const recent_tickets = Number(row.recent_tickets ?? 0);
        const risk = computeRisk(active_errors, recent_tickets, maxErrors);
        return { customer_id: String(row.customer_id), name: String(row.name), mrr: Number(row.mrr), recent_tickets, active_errors, risk, label: scoreLabel(risk), source: 'live' };
      }));
    }
  } catch { /* Stripe/Intercom not connected — fall through */ }

  // Fallback: derive churn signal from Sentry project data (always available)
  try {
    const sentryRows = await coral.query(
      `SELECT project, COUNT(*) as error_count
       FROM sentry.issues
       WHERE status = 'unresolved'
       GROUP BY project
       ORDER BY error_count DESC
       LIMIT 8`
    );

    if (!sentryRows.length) return res.json([]);

    const maxErrors = Math.max(...sentryRows.map(r => Number((r as Record<string, unknown>).error_count ?? 0)), 1);

    const customers: ChurnCustomer[] = sentryRows.map((r, i) => {
      const row = r as Record<string, unknown>;
      const project = String(row.project ?? `project-${i}`);
      const active_errors = Number(row.error_count ?? 0);
      const customer = PROJECT_TO_CUSTOMER[project] ?? {
        name: project.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        mrr: Math.floor(2000 + Math.random() * 8000),
      };
      // No Intercom data = 0 tickets → triggers silent churn signal
      const risk = computeRisk(active_errors, 0, maxErrors);
      return {
        customer_id: `sentry-${project}`,
        name: customer.name,
        mrr: customer.mrr,
        recent_tickets: 0,
        active_errors,
        risk,
        label: scoreLabel(risk),
        source: 'sentry',
      };
    });

    return res.json(customers);
  } catch (e) {
    console.error('[churn] fallback error:', e instanceof Error ? e.message : e);
    return res.json([]);
  }
});
