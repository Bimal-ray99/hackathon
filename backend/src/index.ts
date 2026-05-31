import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { analyzeRouter } from './routes/analyze';
import { incidentsRouter } from './routes/incidents';
import { timelineRouter } from './routes/timeline';
import { impactRouter } from './routes/impact';
import { streamRouter } from './routes/stream';
import { autopilotRouter } from './routes/autopilot';
import { remediationRouter } from './routes/remediation';
import { flagsRouter } from './routes/flags';
import { pulseRouter } from './routes/pulse';
import { diagnosisRouter } from './routes/diagnosis';
import { churnRouter } from './routes/churn';
import { noiseRouter } from './routes/noise';
import { setupMCPServer } from './mcp/server';
import { coralActivityBus, getRecentActivity, CoralQueryEvent } from './coral/client';

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000' }));
app.use(express.json());

app.use('/api/analyze', analyzeRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api/timeline', timelineRouter);
app.use('/api/impact', impactRouter);
app.use('/api/stream', streamRouter);
app.use('/api/autopilot', autopilotRouter);
app.use('/api/remediation', remediationRouter);
app.use('/api/flags', flagsRouter);
app.use('/api/pulse', pulseRouter);
app.use('/api/diagnosis', diagnosisRouter);
app.use('/api/churn', churnRouter);
app.use('/api/noise', noiseRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// GET /api/coral/activity — SSE stream of live Coral query events
app.get('/api/coral/activity', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send recent history on connect
  const recent = getRecentActivity();
  res.write(`event: history\ndata: ${JSON.stringify(recent)}\n\n`);

  const handler = (event: CoralQueryEvent) => {
    res.write(`event: query\ndata: ${JSON.stringify(event)}\n\n`);
  };

  coralActivityBus.on('query', handler);
  req.on('close', () => coralActivityBus.off('query', handler));
});

app.get('/api/health/coral', async (_req, res) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const execAsync = promisify(exec);
  try {
    const { stdout } = await execAsync('coral --version', { timeout: 5000 });
    res.json({ connected: true, mode: 'live', version: stdout.trim() });
  } catch {
    res.json({ connected: false, mode: 'offline' });
  }
});

setupMCPServer(app);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`PulseIQ backend running on :${PORT}`));
}

export { app };
