import { Router } from 'express';

export const timelineRouter = Router();

timelineRouter.get('/:id', (_req, res) => {
  // Return empty array while integrating live timeline
  res.json([]);
});
