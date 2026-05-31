import { Router } from 'express';
import { CoralClient } from '../coral/client';

export const incidentsRouter = Router();
const coral = new CoralClient();

incidentsRouter.get('/', async (_req, res) => {
  console.log('[incidents] GET /api/incidents called');
  const incidents = await coral.getLiveIncidents();
  console.log('[incidents] returning', incidents.length, 'incidents:', JSON.stringify(incidents).slice(0, 400));
  res.json(incidents);
});
