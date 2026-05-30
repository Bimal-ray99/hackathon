import { Router } from 'express';
import { CoralClient } from '../coral/client';
import { SEED_TIMELINE } from '../seed/data';

export const timelineRouter = Router();
const coral = new CoralClient();

timelineRouter.get('/:id', async (_req, res) => {
  try {
    const data = await coral.runIncidentQuery('inc-001');
    res.json(data.timeline.length > 0 ? data.timeline : SEED_TIMELINE);
  } catch {
    res.json(SEED_TIMELINE);
  }
});
