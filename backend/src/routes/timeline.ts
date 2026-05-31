import { Router } from 'express';
import { CoralClient } from '../coral/client';

export const timelineRouter = Router();
const coral = new CoralClient();

timelineRouter.get('/:id', async (req, res) => {
  try {
    const data = await coral.runIncidentQuery(req.params.id);
    res.json(data.timeline);
  } catch {
    res.json([]);
  }
});
