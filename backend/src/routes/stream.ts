import { Router, Request, Response } from 'express';
import { CoralClient } from '../coral/client';
import { GeminiAnalyzer } from '../gemini/analyzer';
import { SEED_ANALYSIS } from '../seed/data';

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
    const incidentData = allRows.length > 0
      ? await coral.runIncidentQuery('inc-001')
      : { ...SEED_ANALYSIS };

    const aiResult = await gemini.analyze(question, incidentData);

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
