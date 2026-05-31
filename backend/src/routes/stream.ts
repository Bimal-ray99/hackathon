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

    // RAG: fetch rich grounded context from real Coral sources in parallel
    const [stackRes, slackRes, flagRes, commitRes] = await Promise.allSettled([
      coral.query(
        `SELECT title, culprit FROM sentry.issues WHERE status = 'unresolved' ORDER BY first_seen DESC LIMIT 3`
      ),
      coral.query(
        `SELECT text, ts FROM slack.messages WHERE channel = 'incidents' ORDER BY ts DESC LIMIT 5`
      ),
      coral.query(
        `SELECT key, name, description FROM launchdarkly.feature_flags WHERE project_key = 'default' LIMIT 5`
      ),
      coral.query(
        `SELECT commit__message as message, commit__author__name as author FROM github.commits ORDER BY commit__author__date DESC LIMIT 3`
      ),
    ]);

    const ragContext = {
      stackTraces: stackRes.status === 'fulfilled' ? (stackRes.value as { title: string; culprit: string }[]) : [],
      slackMessages: slackRes.status === 'fulfilled' ? (slackRes.value as { text: string; ts: string }[]) : [],
      flagDetails: flagRes.status === 'fulfilled' ? (flagRes.value as { key: string; description: string }[]) : [],
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
