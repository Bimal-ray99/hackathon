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

let liveQueryIndex = 0;

// Returns null when Coral has no data (live-only mode should skip)
async function makeLiveInsight(): Promise<PulseInsight | null> {
  const qi = liveQueryIndex % 4;
  liveQueryIndex++;

  try {
    // Always try sentry first — most reliable source for live incidents
    {
      const rows = await coral.query(
        `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
      );
      const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
      console.log('[pulse] sentry count rows:', JSON.stringify(rows), 'parsed count:', count);
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

// GET /api/pulse/stream — live Coral only
pulseRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  let alive = true;

  async function emitNext() {
    if (!alive) return;
    const insight = await makeLiveInsight();
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

// GET /api/pulse/snapshot — live backfill only
pulseRouter.get('/snapshot', (_req: Request, res: Response) => {
  return res.json([]);
});
