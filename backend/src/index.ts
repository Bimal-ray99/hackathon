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

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => console.log(`PulseIQ backend running on :${PORT}`));
}

export { app };
