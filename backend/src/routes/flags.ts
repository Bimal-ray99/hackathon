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
  // Each factor deducts from 100
  const errorPenalty    = Math.min(40, Math.floor((data.error_count / 847) * 40));
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

// GET /api/flags/safety?flag_key=new-upload-flow&seed=true
flagsRouter.get('/safety', async (req: Request, res: Response) => {
  const flagKey = String(req.query.flag_key || 'new-upload-flow');
  const useSeed = req.query.seed !== 'false';

  if (useSeed) {
    const data = SEED_FLAG_SAFETY[flagKey] ?? SEED_FLAG_SAFETY['new-upload-flow'];
    return res.json({ flag_key: flagKey, ...computeSafetyScore(data), raw: data, source: 'seed' });
  }

  try {
    const errorRows = await coral.query(
      `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
    );
    const errorCount = Number((errorRows[0] as Record<string, unknown>)?.count ?? 0);

    const flagRows = await coral.query(
      `SELECT * FROM launchdarkly.feature_flags WHERE key = '${flagKey}' LIMIT 1`
    );
    const flag = flagRows[0] as Record<string, unknown> | undefined;

    if (!errorRows.length && !flagRows.length) {
      return res.json({ flag_key: flagKey, score: null, source: 'live', error: 'No Coral data' });
    }

    const liveData = {
      error_count: errorCount,
      affected_customers: 12,
      rollback_count: flag?.archived ? 1 : 0,
      blast_radius_pct: flag?.includeInSnippet ? 100 : 50,
    };
    return res.json({ flag_key: flagKey, ...computeSafetyScore(liveData), raw: liveData, source: 'live' });
  } catch {
    return res.json({ flag_key: flagKey, score: null, source: 'live', error: 'Coral unavailable' });
  }
});

// GET /api/flags/all-scores — scores all known flags for the sidebar
flagsRouter.get('/all-scores', async (_req: Request, res: Response) => {
  const scores = await Promise.all(
    Object.keys(SEED_FLAG_SAFETY).map(async (key) => {
      const data = SEED_FLAG_SAFETY[key];
      const result = computeSafetyScore(data);
      return { flag_key: key, ...result };
    })
  );
  return res.json(scores);
});
