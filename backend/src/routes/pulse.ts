import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';

export const pulseRouter = Router();
const coral = new CoralClient();

interface PulseInsight {
  id: string;
  ts: string;
  sources: string[];
  text: string;
  severity: 'info' | 'warning' | 'critical';
  impact: string;
  live: boolean;
}

const SEED_INSIGHTS: Omit<PulseInsight, 'id' | 'ts' | 'live'>[] = [
  {
    sources: ['sentry', 'launchdarkly'],
    text: 'Error rate for Enterprise tier spiked 40% — correlates with new-upload-flow flag rollout 8 min ago',
    severity: 'critical',
    impact: '+847 errors',
  },
  {
    sources: ['stripe', 'intercom'],
    text: 'Intercom ticket volume dropped 60% for upload issues — customers stopped reporting, not stopped experiencing',
    severity: 'warning',
    impact: '12 silent',
  },
  {
    sources: ['github', 'sentry'],
    text: 'Commit a3f9c21 (upload-refactor) touched 4 files now appearing in top Sentry stack traces',
    severity: 'warning',
    impact: '4 files',
  },
  {
    sources: ['stripe', 'launchdarkly'],
    text: '$35,200 MRR at risk — all 12 Enterprise accounts are in new-upload-flow rollout segment',
    severity: 'critical',
    impact: '$35.2K',
  },
  {
    sources: ['github', 'launchdarkly'],
    text: 'Flag new-upload-flow enabled on same deploy as PR #847 — 3 min separation, high correlation',
    severity: 'info',
    impact: '3m delta',
  },
  {
    sources: ['sentry', 'stripe'],
    text: 'Acme Corp error rate 3× baseline — $8,400/mo at risk, no Intercom tickets filed (customer gave up)',
    severity: 'warning',
    impact: '$8.4K',
  },
  {
    sources: ['launchdarkly', 'sentry'],
    text: 'auth-latency-fix flag active for 3 customers — zero correlated Sentry errors. Clean rollout signal',
    severity: 'info',
    impact: '0 errors',
  },
  {
    sources: ['github', 'stripe'],
    text: 'PR #891 (dashboard-v2) deployed last week — $12K MRR in pilot cohort, Sentry error count flat',
    severity: 'info',
    impact: '+$12K',
  },
  {
    sources: ['intercom', 'stripe'],
    text: 'Globex Inc opened 4 tickets in past hour — $6,200 MRR customer, no flag rollback yet initiated',
    severity: 'warning',
    impact: '4 tickets',
  },
  {
    sources: ['sentry', 'github'],
    text: 'Stack trace fingerprint matches 2 open issues from March outage — same code path, new-upload-flow',
    severity: 'critical',
    impact: 'repeat bug',
  },
];

let seedIndex = 0;
let liveQueryIndex = 0;

function makeSeedInsight(): PulseInsight {
  const s = SEED_INSIGHTS[seedIndex % SEED_INSIGHTS.length];
  seedIndex++;
  return {
    id: `pulse-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    ts: new Date().toISOString(),
    sources: s.sources,
    text: s.text,
    severity: s.severity,
    impact: s.impact,
    live: false,
  };
}

// Returns null when Coral has no data (live-only mode should skip)
async function makeLiveInsight(): Promise<PulseInsight | null> {
  const qi = liveQueryIndex % 4;
  liveQueryIndex++;

  try {
    if (qi === 0) {
      const rows = await coral.query(
        `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
      );
      const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
      if (count > 0) {
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry'],
          text: `${count} unresolved Sentry errors active right now — cross-referencing flag rollouts`,
          severity: count > 100 ? 'critical' : count > 20 ? 'warning' : 'info',
          impact: `${count} errors`,
          live: true,
        };
      }
    }

    if (qi === 1) {
      const rows = await coral.query(
        `SELECT key, name, creation_date FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 3`
      );
      if (rows.length > 0) {
        const flag = rows[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['launchdarkly'],
          text: `LaunchDarkly: flag "${flag.key ?? flag.name}" active — monitoring for correlated error spikes`,
          severity: 'info',
          impact: `${rows.length} flag${rows.length > 1 ? 's' : ''}`,
          live: true,
        };
      }
    }

    if (qi === 2) {
      const rows = await coral.query(
        `SELECT commit__message as message, commit__author__name as author FROM github.commits ORDER BY commit__author__date DESC LIMIT 1`
      );
      if (rows.length > 0) {
        const c = rows[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['github'],
          text: `Latest commit: "${String(c.message ?? '').slice(0, 80)}" by ${c.author} — scanning for flag correlation`,
          severity: 'info',
          impact: 'new commit',
          live: true,
        };
      }
    }

    if (qi === 3) {
      // Cross-join: sentry errors + LD flags active at same time
      const [errRows, flagRows] = await Promise.all([
        coral.query(`SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`),
        coral.query(`SELECT COUNT(*) as count FROM launchdarkly.feature_flags WHERE project_key = 'default'`),
      ]);
      const errCount = Number((errRows[0] as Record<string, unknown>)?.count ?? 0);
      const flagCount = Number((flagRows[0] as Record<string, unknown>)?.count ?? 0);
      if (errCount > 0 && flagCount > 0) {
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry', 'launchdarkly'],
          text: `Coral JOIN: ${errCount} active Sentry errors × ${flagCount} LD flags — computing correlation window`,
          severity: errCount > 50 ? 'warning' : 'info',
          impact: `${errCount}e × ${flagCount}f`,
          live: true,
        };
      }
    }
  } catch { /* Coral unavailable */ }

  return null;
}

// GET /api/pulse/stream?seed=true|false
pulseRouter.get('/stream', (req: Request, res: Response) => {
  const useSeed = req.query.seed !== 'false';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let alive = true;

  async function emitNext() {
    if (!alive) return;
    let insight: PulseInsight | null = null;

    if (useSeed) {
      // Try live first; fall back to seed
      insight = await makeLiveInsight();
      if (!insight) insight = makeSeedInsight();
    } else {
      insight = await makeLiveInsight();
      // In live-only mode: no data = no emit
    }

    if (insight && alive) {
      res.write(`event: insight\ndata: ${JSON.stringify(insight)}\n\n`);
    }
  }

  emitNext();

  const interval = setInterval(() => {
    if (!alive) { clearInterval(interval); return; }
    emitNext();
  }, 7000);

  req.on('close', () => {
    alive = false;
    clearInterval(interval);
  });
});

// GET /api/pulse/snapshot?seed=true|false — initial backfill
pulseRouter.get('/snapshot', (req: Request, res: Response) => {
  const useSeed = req.query.seed !== 'false';
  if (!useSeed) return res.json([]);

  const now = Date.now();
  const snapshot = SEED_INSIGHTS.slice(0, 6).map((s, i) => ({
    id: `snap-${i}`,
    ts: new Date(now - (6 - i) * 95000).toISOString(),
    sources: s.sources,
    text: s.text,
    severity: s.severity,
    impact: s.impact,
    live: false,
  }));
  return res.json(snapshot.reverse());
});
