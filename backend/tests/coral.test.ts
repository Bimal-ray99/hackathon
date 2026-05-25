import { CoralClient } from '../src/coral/client';

describe('CoralClient', () => {
  beforeAll(() => {
    process.env.CORAL_USE_SEED = 'true';
  });

  it('returns seed data when CORAL_USE_SEED=true', async () => {
    const client = new CoralClient();
    const result = await client.query('SELECT * FROM sentry.errors LIMIT 1');
    expect(result).toBeDefined();
    expect(Array.isArray(result)).toBe(true);
  });

  it('runIncidentQuery returns IncidentAnalysis shape', async () => {
    const client = new CoralClient();
    const result = await client.runIncidentQuery('inc-001');
    expect(result).toHaveProperty('mrr_at_risk');
    expect(result).toHaveProperty('affected_customers');
    expect(result).toHaveProperty('coral_query');
    expect(typeof result.mrr_at_risk).toBe('number');
  });
});
