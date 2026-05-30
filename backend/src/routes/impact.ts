import { Router } from 'express';
import { CoralClient } from '../coral/client';
import { SEED_ANALYSIS, SEED_CUSTOMERS } from '../seed/data';

export const impactRouter = Router();
const coral = new CoralClient();

impactRouter.get('/:id', async (req, res) => {
  try {
    const data = await coral.runIncidentQuery(req.params.id);
    res.json({
      incidentId: req.params.id,
      mrr_at_risk: data.mrr_at_risk || SEED_ANALYSIS.mrr_at_risk,
      affected_customers: data.affected_customers.length > 0 ? data.affected_customers : SEED_CUSTOMERS,
      support_ticket_count: data.support_ticket_count || SEED_ANALYSIS.support_ticket_count,
      sources_queried: data.sources_queried
    });
  } catch {
    res.json({
      incidentId: req.params.id,
      mrr_at_risk: SEED_ANALYSIS.mrr_at_risk,
      affected_customers: SEED_CUSTOMERS,
      support_ticket_count: SEED_ANALYSIS.support_ticket_count,
      sources_queried: SEED_ANALYSIS.sources_queried
    });
  }
});
