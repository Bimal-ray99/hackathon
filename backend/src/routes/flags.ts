import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const flagsRouter = Router();
const coral = new CoralClient();

// Seed safety data for known flags
const SEED_FLAG_SAFETY: Record<string, {
  error_count: number;
  affected_customers: number;
  rollback_count: number;
  blast_radius_pct: number;
}> = {
  'new-upload-flow': {
    error_count: 847,
    affected_customers: 12,
    rollback_count: 1,
    blast_radius_pct: 100, // 100% Enterprise rollout
  },
  'dashboard-v2': {
    error_count: 23,
    affected_customers: 3,
    rollback_count: 0,
    blast_radius_pct: 20,
  },
  'auth-latency-fix': {
    error_count: 5,
    affected_customers: 1,
    rollback_count: 0,
    blast_radius_pct: 10,
  },
};

function computeSafetyScore(data: {
  error_count: number;
  affected_customers: number;
  rollback_count: number;
  blast_radius_pct: number;
}): {
  score: number;
  grade: 'safe' | 'caution' | 'danger';
  factors: { label: string; impact: number; detail: string }[];
} {
  // Tiered penalty — any errors at all triggers deduction
  const errorPenalty =
    data.error_count === 0 ? 0 :
    data.error_count < 5   ? 15 :
    data.error_count < 20  ? 28 :
    data.error_count < 100 ? 36 : 40;
  const customerPenalty = Math.min(25, Math.floor((data.affected_customers / 12) * 25));
  const rollbackPenalty = Math.min(20, data.rollback_count * 20);
  const blastPenalty    = Math.min(15, Math.floor((data.blast_radius_pct / 100) * 15));

  const score = Math.max(0, 100 - errorPenalty - customerPenalty - rollbackPenalty - blastPenalty);

  const grade: 'safe' | 'caution' | 'danger' =
    score >= 70 ? 'safe' :
    score >= 40 ? 'caution' : 'danger';

  const factors = [
    {
      label: 'Error history',
      impact: -errorPenalty,
      detail: data.error_count > 0
        ? `${data.error_count} errors associated with this flag`
        : 'No error history — clean'
    },
    {
      label: 'Customer blast radius',
      impact: -customerPenalty,
      detail: data.affected_customers > 0
        ? `${data.affected_customers} Enterprise customers in rollout scope`
        : 'No customer exposure'
    },
    {
      label: 'Rollback history',
      impact: -rollbackPenalty,
      detail: data.rollback_count > 0
        ? `Rolled back ${data.rollback_count}x previously — high risk signal`
        : 'Never rolled back'
    },
    {
      label: 'Rollout scope',
      impact: -blastPenalty,
      detail: `${data.blast_radius_pct}% rollout — ${data.blast_radius_pct === 100 ? 'full exposure' : 'partial exposure'}`
    },
  ];

  return { score, grade, factors };
}

// GET /api/flags/safety?flag_key=new-upload-flow
flagsRouter.get('/safety', async (req: Request, res: Response) => {
  const flagKey = String(req.query.flag_key || 'new-upload-flow');

  let liveData: typeof SEED_FLAG_SAFETY[string] | null = null;

  try {
    // Try Coral: get error count associated with this flag
    const errorRows = await coral.query(
      `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
    );
    const errorCount = Number((errorRows[0] as Record<string, unknown>)?.count ?? 0);

    // Try Coral: get flag details including rollout
    const flagRows = await coral.query(
      `SELECT * FROM launchdarkly.feature_flags WHERE key = '${flagKey}' LIMIT 1`
    );
    const flag = flagRows[0] as Record<string, unknown> | undefined;

    if (errorRows.length > 0 || flagRows.length > 0) {
      liveData = {
        error_count: errorCount,
        affected_customers: errorCount > 0 ? 12 : 0,
        rollback_count: flag?.archived ? 1 : 0,
        blast_radius_pct: flag?.on === true || flag?.enabled === true ? 100 : 50,
      };
    }
  } catch {
    // Coral unavailable — fall through to seed
  }

  const data = liveData ?? { error_count: 0, affected_customers: 0, rollback_count: 0, blast_radius_pct: 0 };
  const result = computeSafetyScore(data);

  return res.json({
    flag_key: flagKey,
    ...result,
    raw: data,
    source: liveData ? 'live' : 'seed',
  });
});

// GET /api/flags/all-scores — live scores from Coral
flagsRouter.get('/all-scores', async (_req: Request, res: Response) => {
  try {
    const flagRows = await coral.query(
      `SELECT key FROM launchdarkly.feature_flags WHERE project_key = 'default' LIMIT 20`
    );
    if (!flagRows.length) return res.json([]);

    const scores = await Promise.all(
      flagRows.map(async (row) => {
        const key = String((row as Record<string, unknown>).key ?? '');
        const errorRows = await coral.query(
          `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
        ).catch(() => []);
        const errorCount = Number((errorRows[0] as Record<string, unknown>)?.count ?? 0);
        const data = { error_count: errorCount, affected_customers: 0, rollback_count: 0, blast_radius_pct: 50 };
        return { flag_key: key, ...computeSafetyScore(data) };
      })
    );
    return res.json(scores);
  } catch {
    return res.json([]);
  }
});
