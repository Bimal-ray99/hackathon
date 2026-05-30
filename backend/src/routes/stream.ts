import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GeminiAnalyzer } from '../gemini/analyzer';
import { SEED_ANALYSIS } from '../seed/data';

export const streamRouter = Router();
const coral = new CoralClient();
const gemini = new GeminiAnalyzer();

const SOURCES = ['launchdarkly', 'github', 'sentry', 'slack'] as const;

// Seed RAG context injected when Coral unavailable
const SEED_RAG_CONTEXT = {
  stackTraces: [
    { title: "TypeError: Cannot read properties of undefined (reading 'stream')", culprit: 'upload/handler.ts in processUpload' },
    { title: 'UnhandledPromiseRejection: stream is not defined', culprit: 'upload/chunks.ts in splitChunks' },
    { title: 'Error: Multipart upload failed: unexpected end of stream', culprit: 'upload/multipart.ts in finalize' },
  ],
  slackMessages: [
    { text: '@oncall upload is broken for enterprise customers, files failing at 10MB+', ts: '2024-05-28T14:40:00Z' },
    { text: 'new-upload-flow flag was just enabled for 100% Enterprise — timing matches the spike', ts: '2024-05-28T14:38:00Z' },
    { text: 'sarah.chen deployed upload-refactor 3 minutes before errors started', ts: '2024-05-28T14:37:00Z' },
  ],
  flagDetails: [
    { key: 'new-upload-flow', description: 'Chunked streaming upload implementation for large files (>5MB)' },
    { key: 'auth-latency-fix', description: 'Token refresh optimization for high-frequency auth' },
  ],
  commitMessages: [
    { message: 'feat: new upload flow with chunked transfer', author: 'sarah.chen' },
    { message: 'refactor: replace getStream() with stream() in upload handler', author: 'sarah.chen' },
  ],
};

streamRouter.get('/', async (req: Request, res: Response) => {
  const question = String(req.query.question || 'Why are there errors?');
  const useSeed = req.query.seed !== 'false';

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
    const incidentData = allRows.length > 0
      ? await coral.runIncidentQuery('inc-001')
      : { ...SEED_ANALYSIS };

    // RAG: fetch rich context in parallel
    let ragContext = SEED_RAG_CONTEXT;

    if (!useSeed) {
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

      const stackTraces = stackRes.status === 'fulfilled' && stackRes.value.length > 0
        ? (stackRes.value as { title: string; culprit: string }[])
        : SEED_RAG_CONTEXT.stackTraces;

      const slackMessages = slackRes.status === 'fulfilled' && slackRes.value.length > 0
        ? (slackRes.value as { text: string; ts: string }[])
        : SEED_RAG_CONTEXT.slackMessages;

      const flagDetails = flagRes.status === 'fulfilled' && flagRes.value.length > 0
        ? (flagRes.value as { key: string; description: string }[])
        : SEED_RAG_CONTEXT.flagDetails;

      const commitMessages = commitRes.status === 'fulfilled' && commitRes.value.length > 0
        ? (commitRes.value as { message: string; author: string }[])
        : SEED_RAG_CONTEXT.commitMessages;

      ragContext = { stackTraces, slackMessages, flagDetails, commitMessages };
    }

    const aiResult = await gemini.analyze(question, incidentData, ragContext);

    send('complete', {
      ...incidentData,
      ...aiResult,
      question,
      source_results: sourceResults
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : 'Analysis failed';
    send('error', { message: errMsg, fallback: { ...SEED_ANALYSIS, question } });
    send('complete', { ...SEED_ANALYSIS, question, source_results: sourceResults });
  }

  res.end();
});
