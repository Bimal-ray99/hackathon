import { Router } from 'express';
import { SEED_ANALYSIS, SEED_CUSTOMERS } from '../seed/data';

export const impactRouter = Router();

impactRouter.get('/:id', (req, res) => {
  const { id } = req.params;
  if (id !== 'inc-001') {
    return res.status(404).json({ error: 'Incident not found' });
  }
  return res.json({
    incidentId: id,
    mrr_at_risk: SEED_ANALYSIS.mrr_at_risk,
    affected_customers: SEED_CUSTOMERS,
    support_ticket_count: SEED_ANALYSIS.support_ticket_count,
    sources_queried: SEED_ANALYSIS.sources_queried
  });
});
