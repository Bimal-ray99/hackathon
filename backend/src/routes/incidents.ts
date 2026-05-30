import { Router } from 'express';
import { CoralClient } from '../coral/client';

export const incidentsRouter = Router();
const coral = new CoralClient();

incidentsRouter.get('/', async (req, res) => {
  const useSeed = req.query.seed !== 'false';
  const incidents = await coral.getLiveIncidents(useSeed);
  res.json(incidents);
});
