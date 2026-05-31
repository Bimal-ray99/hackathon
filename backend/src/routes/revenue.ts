import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const revenueRouter = Router();
const coral = new CoralClient();

const SEED_COMMITS = [
  {
    sha: 'a3f9c21',
    message: 'feat: new upload flow with chunked transfer',
    author: 'sarah.chen',
    date: '2024-05-28',
    flag: 'new-upload-flow',
    features: ['upload', 'file-processing'],
    mrr_delta: -35200,
    arr_impact: -422400,
    customers_affected: 12,
    status: 'incident' as const,
  },
  {
    sha: 'c9e1f44',
    message: 'feat: bulk export for Enterprise tier',
    author: 'james.park',
    date: '2024-05-15',
    flag: null,
    features: ['export', 'enterprise'],
    mrr_delta: 28900,
    arr_impact: 346800,
    customers_affected: 15,
    status: 'positive' as const,
  },
  {
    sha: 'f2a8b3c',
    message: 'feat: dashboard-v2 analytics redesign',
    author: 'mike.torres',
    date: '2024-05-22',
    flag: 'dashboard-v2',
    features: ['dashboard', 'analytics'],
    mrr_delta: 12400,
    arr_impact: 148800,
    customers_affected: 8,
    status: 'positive' as const,
  },
  {
    sha: 'b7d2e89',
    message: 'fix: auth token refresh latency',
    author: 'priya.sharma',
    date: '2024-05-20',
    flag: 'auth-latency-fix',
    features: ['auth'],
    mrr_delta: 4200,
    arr_impact: 50400,
    customers_affected: 3,
    status: 'positive' as const,
  },
  {
    sha: 'd5a7b12',
    message: 'refactor: API rate limiting middleware',
    author: 'sarah.chen',
    date: '2024-05-10',
    flag: null,
    features: ['api', 'reliability'],
    mrr_delta: 0,
    arr_impact: 0,
    customers_affected: 0,
    status: 'neutral' as const,
  },
];

// GET /api/revenue/commits
revenueRouter.get('/commits', async (_req: Request, res: Response) => {
  let liveAuthors: Record<string, unknown>[] = [];

  try {
    liveAuthors = await coral.query(
      `SELECT author, COUNT(*) as commit_count FROM github.commits WHERE owner = 'Bimal-ray99' AND repo = 'pulseiq-victim-service' GROUP BY author LIMIT 10`
    );
  } catch { /* seed */ }

  // Engineer ARR rollup
  const byAuthor: Record<string, number> = {};
  for (const c of SEED_COMMITS) {
    byAuthor[c.author] = (byAuthor[c.author] || 0) + Math.max(0, c.arr_impact);
  }
  const engineerArr = Object.entries(byAuthor)
    .map(([author, arr]) => ({ author, arr }))
    .sort((a, b) => b.arr - a.arr);

  const totalPositiveArr = SEED_COMMITS
    .filter(c => c.arr_impact > 0)
    .reduce((sum, c) => sum + c.arr_impact, 0);

  return res.json({
    commits: SEED_COMMITS,
    engineer_arr: engineerArr,
    total_positive_arr: totalPositiveArr,
    live: liveAuthors.length > 0,
  });
});
