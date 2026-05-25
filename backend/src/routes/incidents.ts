import { Router } from 'express';
import { SEED_INCIDENTS } from '../seed/data';

export const incidentsRouter = Router();

incidentsRouter.get('/', (_req, res) => {
  res.json(SEED_INCIDENTS);
});
