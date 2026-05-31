import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const graphRouter = Router();
const coral = new CoralClient();

// GET /api/graph
graphRouter.get('/', async (_req: Request, res: Response) => {
  let liveCount = 0;

  try {
    const rows = await coral.query(
      `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
    );
    liveCount = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
  } catch { /* seed */ }

  const nodes = [
    { id: 'commit:a3f9c21', type: 'commit', label: 'a3f9c21', sublabel: 'upload-refactor', group: 'github' },
    { id: 'commit:b7d2e89', type: 'commit', label: 'b7d2e89', sublabel: 'auth cleanup', group: 'github' },
    { id: 'flag:new-upload-flow', type: 'flag', label: 'new-upload-flow', sublabel: '100% rollout', group: 'launchdarkly' },
    { id: 'flag:auth-latency-fix', type: 'flag', label: 'auth-latency-fix', sublabel: '10% rollout', group: 'launchdarkly' },
    { id: 'error:TypeError', type: 'error', label: 'TypeError', sublabel: liveCount > 0 ? `${liveCount} live` : '847 events', group: 'sentry' },
    { id: 'customer:acme', type: 'customer', label: 'Acme Corp', sublabel: '$8.4K MRR', group: 'stripe' },
    { id: 'customer:globex', type: 'customer', label: 'Globex Inc', sublabel: '$6.2K MRR', group: 'stripe' },
    { id: 'ticket:silent', type: 'ticket', label: '7 silent users', sublabel: 'stopped filing', group: 'intercom' },
  ];

  const edges = [
    { source: 'commit:a3f9c21', target: 'flag:new-upload-flow', label: 'same deploy', weight: 3, coral_join: 'github.commits JOIN launchdarkly.flags ON deploy_time' },
    { source: 'flag:new-upload-flow', target: 'error:TypeError', label: 'correlates (+40%)', weight: 5, coral_join: 'launchdarkly.flags JOIN sentry.issues ON timestamp' },
    { source: 'flag:new-upload-flow', target: 'customer:acme', label: 'in rollout', weight: 2, coral_join: 'launchdarkly.flags JOIN stripe.customers ON segment' },
    { source: 'flag:new-upload-flow', target: 'customer:globex', label: 'in rollout', weight: 2, coral_join: 'launchdarkly.flags JOIN stripe.customers ON segment' },
    { source: 'error:TypeError', target: 'ticket:silent', label: 'caused silence', weight: 4, coral_join: 'sentry.issues LEFT JOIN intercom.tickets ON customer_id' },
    { source: 'customer:acme', target: 'ticket:silent', label: 'stopped reporting', weight: 3, coral_join: 'stripe.customers LEFT JOIN intercom.tickets ON customer_id' },
    { source: 'commit:b7d2e89', target: 'flag:auth-latency-fix', label: 'same deploy', weight: 1, coral_join: 'github.commits JOIN launchdarkly.flags ON deploy_time' },
  ];

  return res.json({ nodes, edges, live: liveCount > 0 });
});
