import { Router, Request, Response } from 'express';

export const genomeRouter = Router();

const PAST_INCIDENTS = [
  {
    id: 'INC-2024-03-12',
    title: 'Enterprise Upload Outage — March 2024',
    resolved_in: '2h 14m',
    resolution: 'Rolled back feature flag upload-v2, reverted commit d4f82c1. Root cause: async handler dropped errors silently.',
    signals: { error_surge: true, flag_rollout: true, enterprise_only: true, upload_path: true, silent_customers: true },
    similarity: 87,
  },
  {
    id: 'INC-2024-01-08',
    title: 'File Processing Pipeline Failure',
    resolved_in: '45m',
    resolution: 'Scaled up worker queue. No flag involved — pure infrastructure.',
    signals: { error_surge: true, flag_rollout: false, enterprise_only: false, upload_path: true, silent_customers: false },
    similarity: 52,
  },
  {
    id: 'INC-2023-11-20',
    title: 'Auth Token Expiry Storm',
    resolved_in: '1h 30m',
    resolution: 'Emergency hotfix to token refresh logic. Deployed as direct push to main.',
    signals: { error_surge: true, flag_rollout: false, enterprise_only: true, upload_path: false, silent_customers: false },
    similarity: 31,
  },
];

const SIGNAL_LABELS: Record<string, string> = {
  error_surge: 'Error spike >10×',
  flag_rollout: 'Flag rollout active',
  enterprise_only: 'Enterprise-tier only',
  upload_path: 'Upload code path',
  silent_customers: 'Silent customers (gave up)',
};

// GET /api/genome?incident_id=inc-001
genomeRouter.get('/', (req: Request, res: Response) => {
  const incidentId = String(req.query.incident_id || 'inc-001');

  const currentSignals = {
    error_surge: true,
    flag_rollout: true,
    enterprise_only: true,
    upload_path: true,
    silent_customers: true,
  };

  return res.json({
    incident_id: incidentId,
    current_signals: currentSignals,
    signal_labels: SIGNAL_LABELS,
    matches: PAST_INCIDENTS,
    top_match: PAST_INCIDENTS[0],
    recommendation: `87% match with March 2024 upload outage. That resolved in 2h 14m via flag rollback + commit revert. Apply same playbook now.`,
  });
});
