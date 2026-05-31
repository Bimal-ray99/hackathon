import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GeminiAnalyzer } from '../gemini/analyzer';

export const streamRouter = Router();
const coral = new CoralClient();
const gemini = new GeminiAnalyzer();

const SOURCES = ['launchdarkly', 'github', 'sentry', 'slack'] as const;

streamRouter.get('/', async (req: Request, res: Response) => {
  const question = String(req.query.question || 'Why are there errors?');

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('start', { message: 'Starting Coral JOINs...', sources: SOURCES });

  const allRows: Record<string, unknown>[] = [];
  const sourceResults: Record<string, { rows: number; live: boolean }> = {};

  SOURCES.forEach(source => send('source_start', { source }));

  const sourceTimeout = (source: string, ms: number) =>
    new Promise<{ rows: Record<string, unknown>[] }>(resolve =>
      setTimeout(() => {
        console.log(`[stream] ${source} timed out after ${ms}ms`);
        resolve({ rows: [] });
      }, ms)
    );

  await Promise.all(
    SOURCES.map(async (source) => {
      const timeout = source === 'github' ? 12000 : 20000;
      try {
        const result = await Promise.race([
          coral.querySource(source),
          sourceTimeout(source, timeout),
        ]);
        allRows.push(...result.rows);
        sourceResults[source] = { rows: result.rows.length, live: result.rows.length > 0 };
        send('source_done', { source, rows: result.rows.length, live: result.rows.length > 0 });
      } catch {
        sourceResults[source] = { rows: 0, live: false };
        send('source_done', { source, rows: 0, live: false });
      }
    })
  );

  send('gemini_start', { message: 'Gemini analyzing cross-source data...' });

  try {
    // Run all RAG queries in parallel — don't block on TIMELINE_QUERY alone
    const [sentryRes, ldRes, slackRes, commitRes, timelineRes] = await Promise.allSettled([
      coral.query(`SELECT title, level, project, first_seen FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 5`),
      coral.query(`SELECT key, name, creation_date FROM launchdarkly.feature_flags WHERE project_key = 'default' ORDER BY creation_date DESC LIMIT 5`),
      coral.query(`SELECT text, ts FROM slack.messages WHERE channel = 'incidents' ORDER BY ts DESC LIMIT 5`),
      coral.query(`SELECT commit__message as message, commit__author__name as author, commit__author__date as date FROM github.commits ORDER BY commit__author__date DESC LIMIT 3`),
      coral.query(`SELECT 'sentry' AS source, title, level AS description, first_seen AS timestamp FROM sentry.issues ORDER BY first_seen DESC LIMIT 10`),
    ]);

    const sentryIssues = sentryRes.status === 'fulfilled' ? sentryRes.value : [];
    const ldFlags = ldRes.status === 'fulfilled' ? ldRes.value : [];
    const timelineRows = timelineRes.status === 'fulfilled' ? timelineRes.value : [];

    // Build enriched timeline: sentry + LD combined
    const sentryTimeline = (sentryIssues as Record<string,unknown>[]).map((r, i) => ({
      id: String(i + 1),
      timestamp: String(r.first_seen ?? new Date().toISOString()),
      source: 'sentry' as const,
      type: 'error_spike' as const,
      title: String(r.title ?? ''),
      description: String(r.level ?? 'error'),
      severity: 'critical' as const,
    }));
    const ldTimeline = (ldFlags as Record<string,unknown>[]).map((r, i) => ({
      id: String(sentryTimeline.length + i + 1),
      timestamp: String(r.creation_date ?? new Date().toISOString()),
      source: 'launchdarkly' as const,
      type: 'flag_change' as const,
      title: String(r.key ?? ''),
      description: `flag "${r.key}" active in production`,
      severity: 'info' as const,
    }));
    const timeline = [...sentryTimeline, ...ldTimeline].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    const sourcesQueried = ['sentry'];
    if (ldFlags.length > 0) sourcesQueried.push('launchdarkly');
    if ((commitRes.status === 'fulfilled' ? commitRes.value : []).length > 0) sourcesQueried.push('github');

    const incidentData = {
      incidentId: 'inc-live',
      timeline,
      sources_queried: sourcesQueried,
      coral_query: `SELECT title, level FROM sentry.issues CROSS JOIN launchdarkly.feature_flags`,
      summary: '',
      root_cause: '',
      recommended_action: '',
      confidence: 'low' as const,
      mrr_at_risk: 0,
      affected_customers: [],
      support_ticket_count: 0,
    };

    const ragContext = {
      stackTraces: sentryIssues as { title: string; level?: string; project?: string }[],
      slackMessages: slackRes.status === 'fulfilled' ? (slackRes.value as { text: string; ts: string }[]) : [],
      flagDetails: ldFlags as { key: string; description?: string; name?: string }[],
      commitMessages: commitRes.status === 'fulfilled' ? (commitRes.value as { message: string; author: string }[]) : [],
    };

    const aiResult = await gemini.analyze(question, incidentData, ragContext);

    send('complete', {
      ...incidentData,
      ...aiResult,
      question,
      source_results: sourceResults
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Analysis failed';
    console.error('[stream] analysis error:', errMsg);
    send('error', { message: errMsg });
    send('complete', {
      incidentId: 'inc-001',
      summary: 'No data available — Coral sources returned no results.',
      root_cause: 'No data from Coral sources.',
      recommended_action: 'Connect Coral sources and retry.',
      confidence: 'low',
      mrr_at_risk: 0,
      affected_customers: 0,
      support_ticket_count: 0,
      sources_queried: [],
      coral_query: '',
      timeline: [],
      question,
      source_results: sourceResults
    });
  }

  res.end();
});
