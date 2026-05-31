import { Router } from 'express';
import { CoralClient } from '../coral/client';

export const impactRouter = Router();
const coral = new CoralClient();

impactRouter.get('/:id', async (req, res) => {
  try {
    const data = await coral.runIncidentQuery(req.params.id);
    res.json({
      incidentId: req.params.id,
      mrr_at_risk: data.mrr_at_risk,
      affected_customers: data.affected_customers,
      support_ticket_count: data.support_ticket_count,
      sources_queried: data.sources_queried
    });
  } catch {
    res.json({
      incidentId: req.params.id,
      mrr_at_risk: 0,
      affected_customers: [],
      support_ticket_count: 0,
      sources_queried: []
    });
  }
});
