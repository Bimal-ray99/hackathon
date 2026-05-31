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

app.get('/api/health/coral', async (_req, res) => {
  const { exec } = await import('child_process');
  const { promisify } = await import('util');
  const { writeFileSync, unlinkSync } = await import('fs');
  const { tmpdir } = await import('os');
  const { join } = await import('path');
  const execAsync = promisify(exec);
  const tmpFile = join(tmpdir(), `coral_health_${Date.now()}.sql`);
  try {
    writeFileSync(tmpFile, 'SELECT 1', 'utf8');
    await execAsync(`coral sql --format json --file "${tmpFile}"`, { timeout: 8000 });
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    res.json({ connected: true, mode: 'live' });
  } catch {
    try { unlinkSync(tmpFile); } catch { /* ignore */ }
    res.json({ connected: false, mode: 'offline' });
  }
});

setupMCPServer(app);

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`PulseIQ backend running on :${PORT}`));
}

export { app };
