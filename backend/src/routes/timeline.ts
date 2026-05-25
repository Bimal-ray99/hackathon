import { Router } from 'express';
import { SEED_TIMELINE } from '../seed/data';

export const timelineRouter = Router();

timelineRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  if (id !== 'inc-001') {
    return res.json(SEED_TIMELINE.slice(0, 3));
  }
  return res.json(SEED_TIMELINE);
});
