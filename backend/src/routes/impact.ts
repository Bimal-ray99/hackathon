import { Router } from 'express';

export const impactRouter = Router();

impactRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  // Return empty impact object while integrating live data
  return res.json({
    incidentId: id,
    mrr_at_risk: 0,
    affected_customers: [],
    support_ticket_count: 0,
    sources_queried: []
  });
});
