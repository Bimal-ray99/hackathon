import { Router } from 'express';

export const similarityRouter = Router();

interface HistoricalIncident {
  id: string;
  date: string;
  title: string;
  similarity: number;
  root_cause: string;
  resolution: string;
  resolved_by: string;
  time_to_resolve_min: number;
  fix_action: 'ld-rollback' | 'github-pr' | 'manual';
  fix_params: Record<string, string>;
}

const HISTORICAL_INCIDENTS: HistoricalIncident[] = [
  {
    id: 'inc-003',
    date: '2024-03-15',
    title: 'Enterprise upload TypeError spike',
    similarity: 87,
    root_cause: 'file.stream() returned undefined for files >10MB — same root cause as current incident.',
    resolution: 'Disabled new-upload-flow flag for Enterprise segment. Errors resolved within 4 minutes.',
    resolved_by: 'sarah.chen',
    time_to_resolve_min: 12,
    fix_action: 'ld-rollback',
    fix_params: { flag_key: 'new-upload-flow' },
  },
  {
    id: 'inc-007',
    date: '2024-04-02',
    title: 'Streaming upload failure on large files',
    similarity: 61,
    root_cause: 'ReadableStream API mismatch between browser versions. stream.getReader() called on undefined.',
    resolution: 'Rolled back upload-streaming-v2 flag, deployed hotfix with optional chaining on stream object.',
    resolved_by: 'mkwon',
    time_to_resolve_min: 34,
    fix_action: 'ld-rollback',
    fix_params: { flag_key: 'upload-streaming-v2' },
  },
  {
    id: 'inc-012',
    date: '2024-05-01',
    title: 'Enterprise error spike after auth flag rollout',
    similarity: 44,
    root_cause: 'Token refresh race condition exposed under Enterprise session load.',
    resolution: 'Disabled auth-latency-fix flag, reverted token refresh logic.',
    resolved_by: 'jpark',
    time_to_resolve_min: 8,
    fix_action: 'ld-rollback',
    fix_params: { flag_key: 'auth-latency-fix' },
  },
];

// POST /api/similarity
similarityRouter.post('/', (req, res) => {
  const { seed = true } = req.body as { seed?: boolean };
  res.json(seed ? HISTORICAL_INCIDENTS : []);
});
