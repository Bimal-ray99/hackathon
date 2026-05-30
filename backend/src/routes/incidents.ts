import { Router } from 'express';
import { CoralClient } from '../coral/client';

export const incidentsRouter = Router();
const coral = new CoralClient();

incidentsRouter.get('/', async (_req, res) => {
  const incidents = await coral.getLiveIncidents();
  res.json(incidents);
});
