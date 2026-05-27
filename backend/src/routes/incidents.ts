import { Router } from 'express';

export const incidentsRouter = Router();

incidentsRouter.get('/', (_req, res) => {
  // Return empty array while integrating live incidents
  res.json([]);
});
