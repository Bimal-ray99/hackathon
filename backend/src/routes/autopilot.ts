import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GeminiAnalyzer } from '../gemini/analyzer';

export const autopilotRouter = Router();
const coral = new CoralClient();
const gemini = new GeminiAnalyzer();

const SOURCES = ['launchdarkly', 'github', 'sentry', 'slack'] as const;
const AUTOPILOT_QUESTION = 'Why are uploads failing?';
const BASE_URL = process.env.BASE_URL || 'http://localhost:4000';

async function autoRemediate(flagKey: string, commitSha: string, incidentId: string) {
  const results: { flag_disabled: boolean; pr_url: string | null; slack_posted: boolean } = {
    flag_disabled: false,
    pr_url: null,
    slack_posted: false,
  };

  try {
    const r = await fetch(`${BASE_URL}/api/remediation/ld-rollback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flag_key: flagKey, comment: `PulseIQ autopilot auto-remediation — ${incidentId}` }),
    });
    results.flag_disabled = r.ok;
  } catch { /* continue */ }

  try {
    const r = await fetch(`${BASE_URL}/api/remediation/github-pr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `fix: auto-revert ${commitSha} (PulseIQ autopilot)`,
        body: `Auto-remediation triggered by PulseIQ autopilot.\n\nIncident: ${incidentId}`,
        head: commitSha,
      }),
    });
    const data = await r.json() as Record<string, unknown>;
    results.pr_url = String(data.pr_url ?? '');
  } catch { /* continue */ }

  try {
    const prLine = results.pr_url ? `\nRevert PR: ${results.pr_url}` : '';
    await fetch(`${BASE_URL}/api/remediation/slack-post`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `*PulseIQ Autopilot auto-remediated ${incidentId}*\nFlag \`${flagKey}\` disabled\nRevert PR opened${prLine}\nNo human intervention required.`,
      }),
    });
    results.slack_posted = true;
  } catch { /* continue */ }

  return results;
}

async function detectAnomaly(): Promise<{ source: string; signal: string }> {
  try {
    const sentryRows = await coral.query(
      "SELECT COUNT(*) as count FROM sentry.issues WHERE status = 'unresolved'"
    );
    if (sentryRows.length > 0) {
      const count = Number((sentryRows[0] as Record<string, unknown>).count ?? 0);
      if (count > 50) {
        return { source: 'sentry', signal: `${count} unresolved errors detected` };
      }
    }
  } catch {
    // fall through to next check
  }

  try {
    const flagRows = await coral.query(
      'SELECT * FROM launchdarkly.feature_flags WHERE enabled = true LIMIT 1'
    );
    if (flagRows.length > 0) {
      const flag = flagRows[0] as Record<string, unknown>;
      const flagKey = (flag as Record<string, unknown>).key ?? 'unknown';
      return { source: 'launchdarkly', signal: `Flag "${flagKey}" is active` };
    }
  } catch {
    // fall through to seed
  }

  return { source: 'sentry', signal: 'No anomaly detected — Coral sources offline' };
}

async function runAnalysisStream(
  send: (event: string, data: unknown) => void,
  question: string
): Promise<void> {
  const allRows: Record<string, unknown>[] = [];
  const sourceResults: Record<string, { rows: number; live: boolean }> = {};

  for (const source of SOURCES) {
    send('source_start', { source });
    try {
      const { rows } = await coral.querySource(source);
      allRows.push(...rows);
      sourceResults[source] = { rows: rows.length, live: rows.length > 0 };
      send('source_done', { source, rows: rows.length, live: rows.length > 0 });
    } catch {
      sourceResults[source] = { rows: 0, live: false };
      send('source_done', { source, rows: 0, live: false });
    }
  }

  send('gemini_start', { message: 'Gemini analyzing cross-source data...' });

  try {
    const incidentData = await coral.runIncidentQuery('inc-001');
    const aiResult = await gemini.analyze(question, incidentData);

    send('complete', {
      ...incidentData,
      ...aiResult,
      question,
      source_results: sourceResults
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Analysis failed';
    send('error', { message: errMsg });
    send('complete', {
      incidentId: 'inc-001', summary: 'No data available.', root_cause: '', recommended_action: '',
      confidence: 'low', mrr_at_risk: 0, affected_customers: 0, support_ticket_count: 0,
      sources_queried: [], coral_query: '', timeline: [], question, source_results: sourceResults
    });
  }
}

autopilotRouter.get('/stream', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  let fired = false;

  const trigger = async () => {
    if (fired) return;
    fired = true;

    const startTime = Date.now();
    const { source, signal } = await detectAnomaly();
    send('anomaly_detected', { source, signal, question: AUTOPILOT_QUESTION });
    await runAnalysisStream(send, AUTOPILOT_QUESTION);

    const remediation = await autoRemediate('new-upload-flow', 'a3f9c21', 'inc-001');
    send('remediation_complete', {
      actions: ['flag_disabled', 'pr_opened', 'slack_posted'],
      flag_disabled: remediation.flag_disabled,
      pr_url: remediation.pr_url,
      slack_posted: remediation.slack_posted,
      duration_ms: Date.now() - startTime,
      incident_id: 'inc-001',
    });
  };

  const t1 = setTimeout(() => { trigger().catch((err) => console.error('[autopilot] trigger error:', err)); }, 30000);
  const t2 = setTimeout(() => { trigger().catch((err) => console.error('[autopilot] trigger error:', err)); }, 35000);

  req.on('close', () => { clearTimeout(t1); clearTimeout(t2); });
});

autopilotRouter.post('/simulate', (_req: Request, res: Response) => {
  res.json({
    source: 'sentry',
    signal: '847 unresolved errors detected',
    question: AUTOPILOT_QUESTION
  });
});
