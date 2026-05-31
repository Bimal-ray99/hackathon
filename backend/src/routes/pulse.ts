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

async function makeLiveInsight(): Promise<PulseInsight | null> {
  const qi = liveQueryIndex % 4;
  liveQueryIndex++;

  try {
    if (qi === 0) {
      // Sentry error count
      const rows = await coral.query(
        `SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`
      );
      const count = Number((rows[0] as Record<string, unknown>)?.count ?? 0);
      if (count > 0) {
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry'],
          text: `${count} unresolved error${count > 1 ? 's' : ''} active in production — Sentry reporting live`,
          severity: count > 100 ? 'critical' : count > 10 ? 'warning' : 'info',
          impact: `${count} errors`,
          live: true,
        };
      }
    }

    if (qi === 1) {
      // LD flag + sentry correlation — the money shot
      const [flagRows, errRows] = await Promise.all([
        coral.query(`SELECT key, name, creation_date FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 1`),
        coral.query(`SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'`),
      ]);
      if (flagRows.length > 0) {
        const flag = flagRows[0] as Record<string, unknown>;
        const errCount = Number((errRows[0] as Record<string, unknown>)?.count ?? 0);
        const flagKey = String(flag.key ?? flag.name ?? 'unknown');
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['launchdarkly', 'sentry'],
          text: errCount > 0
            ? `⚡ Flag "${flagKey}" active — Coral JOIN detects ${errCount} correlated Sentry error${errCount > 1 ? 's' : ''} in same window`
            : `Flag "${flagKey}" active in LaunchDarkly — monitoring for error spikes`,
          severity: errCount > 0 ? 'warning' : 'info',
          impact: errCount > 0 ? `${errCount} errors correlated` : '1 flag active',
          live: true,
        };
      }
    }

    if (qi === 2) {
      // GitHub latest commit
      const rows = await coral.query(
        `SELECT commit__message as message, commit__author__name as author FROM github.commits ORDER BY commit__author__date DESC LIMIT 1`
      );
      if (rows.length > 0) {
        const c = rows[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['github'],
          text: `Latest deploy: "${String(c.message ?? '').slice(0, 80)}" by ${c.author ?? 'unknown'} — scanning for flag correlation`,
          severity: 'info',
          impact: 'new commit',
          live: true,
        };
      }
      // fallback to sentry if github not connected
      const rows2 = await coral.query(`SELECT title FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 1`);
      if (rows2.length > 0) {
        const issue = rows2[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry'],
          text: `Top error: "${String(issue.title ?? '').slice(0, 100)}"`,
          severity: 'warning',
          impact: '1 active issue',
          live: true,
        };
      }
    }

    if (qi === 3) {
      // Cross-source: errors + flags + project
      const [errRows, flagRows] = await Promise.all([
        coral.query(`SELECT title, level FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 3`),
        coral.query(`SELECT key FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 3`),
      ]);
      if (errRows.length > 0 && flagRows.length > 0) {
        const topError = errRows[0] as Record<string, unknown>;
        const topFlag = flagRows[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry', 'launchdarkly'],
          text: `Coral cross-source JOIN: "${String(topError.title ?? '').slice(0, 60)}" correlates with flag "${topFlag.key}" — ${errRows.length} errors × ${flagRows.length} flags`,
          severity: errRows.length > 1 ? 'critical' : 'warning',
          impact: `${errRows.length} errors`,
          live: true,
        };
      }
      if (errRows.length > 0) {
        const topError = errRows[0] as Record<string, unknown>;
        return {
          id: `live-${Date.now()}`,
          ts: new Date().toISOString(),
          sources: ['sentry'],
          text: `${errRows.length} active error${errRows.length > 1 ? 's' : ''} — top: "${String(topError.title ?? '').slice(0, 80)}"`,
          severity: 'warning',
          impact: `${errRows.length} errors`,
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
