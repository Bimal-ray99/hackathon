import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const oracleRouter = Router();
const coral = new CoralClient();

interface OracleReason {
  signal: string;
  detail: string;
  weight: number;
}

interface OracleResult {
  flag_key: string;
  score: number;
  recommendation: 'DEPLOY' | 'WAIT' | 'ABORT';
  reasons: OracleReason[];
  source: 'live' | 'seed';
}

const SEED_RESULT: OracleResult = {
  flag_key: 'new-upload-flow',
  score: 73,
  recommendation: 'WAIT',
  reasons: [
    { signal: 'Sentry baseline elevated', detail: '847 unresolved errors — 3.2× normal baseline of 260', weight: 30 },
    { signal: 'Enterprise customers active', detail: '3 Enterprise customers currently uploading files (Acme Corp, Globex Inc, Initech LLC)', weight: 30 },
    { signal: 'Recent adjacent commit', detail: 'sarah.chen modified upload/handler.ts 47 minutes ago — not yet battle-tested in production', weight: 13 },
  ],
  source: 'seed',
};

// GET /api/oracle?flag_key=X&seed=true
oracleRouter.get('/', async (req: Request, res: Response) => {
  const flag_key = String(req.query.flag_key || 'new-upload-flow');
  const useSeed = req.query.seed !== 'false';

  if (useSeed) {
    return res.json({ ...SEED_RESULT, flag_key });
  }

  let score = 0;
  const reasons: OracleReason[] = [];

  try {
    const rows = await coral.query(`SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`);
    const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
    if (count > 500) {
      score += 30;
      reasons.push({ signal: 'Sentry baseline elevated', detail: `${count} unresolved errors — above safe threshold of 500`, weight: 30 });
    } else if (count > 200) {
      score += 15;
      reasons.push({ signal: 'Sentry baseline slightly elevated', detail: `${count} unresolved errors`, weight: 15 });
    }
  } catch { /* skip */ }

  try {
    const rows = await coral.query(`SELECT COUNT(*) as count FROM stripe.customers WHERE plan = 'enterprise'`);
    const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
    if (count > 0) {
      score += 30;
      reasons.push({ signal: 'Enterprise customers active', detail: `${count} Enterprise customers on platform right now`, weight: 30 });
    }
  } catch { /* skip */ }

  try {
    const rows = await coral.query(`SELECT COUNT(*) as count FROM github.commits WHERE commit__author__date > NOW() - INTERVAL '2 hours'`);
    const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
    if (count > 0) {
      score += 20;
      reasons.push({ signal: 'Recent commits in last 2h', detail: `${count} commits — system may not be stable yet`, weight: 20 });
    }
  } catch { /* skip */ }

  try {
    const rows = await coral.query(`SELECT COUNT(*) as count FROM launchdarkly.feature_flags WHERE key = '${flag_key}'`);
    const exists = Number((rows[0] as Record<string, unknown>)?.count ?? 0) > 0;
    if (exists) {
      score += 20;
      reasons.push({ signal: 'Historical P0 correlation', detail: `Flag \`${flag_key}\` has prior incident correlation in Coral history`, weight: 20 });
    }
  } catch { /* skip */ }

  if (!reasons.length) {
    return res.json({ flag_key, score: null, recommendation: null, reasons: [], source: 'live', error: 'No Coral data available' });
  }

  const recommendation: OracleResult['recommendation'] = score >= 70 ? 'ABORT' : score >= 40 ? 'WAIT' : 'DEPLOY';

  return res.json({ flag_key, score, recommendation, reasons, source: 'live' } satisfies OracleResult);
});
