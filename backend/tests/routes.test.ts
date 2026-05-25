import request from 'supertest';
import { app } from '../src/index';

beforeAll(() => {
  process.env.CORAL_USE_SEED = 'true';
  process.env.NODE_ENV = 'test';
});

describe('POST /api/analyze', () => {
  it('returns incident analysis for a question', async () => {
    const res = await request(app)
      .post('/api/analyze')
      .send({ question: 'Why are uploads failing?' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('mrr_at_risk');
    expect(res.body).toHaveProperty('timeline');
    expect(res.body).toHaveProperty('coral_query');
    expect(Array.isArray(res.body.timeline)).toBe(true);
  });

  it('returns 400 for missing question', async () => {
    const res = await request(app).post('/api/analyze').send({});
    expect(res.status).toBe(400);
  });
});

describe('GET /api/incidents', () => {
  it('returns list of incidents', async () => {
    const res = await request(app).get('/api/incidents');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('severity');
  });
});

describe('GET /api/timeline/:id', () => {
  it('returns timeline for known incident', async () => {
    const res = await request(app).get('/api/timeline/inc-001');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty('source');
    expect(res.body[0]).toHaveProperty('timestamp');
  });
});

describe('GET /api/impact/:id', () => {
  it('returns impact data for known incident', async () => {
    const res = await request(app).get('/api/impact/inc-001');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('mrr_at_risk');
    expect(res.body).toHaveProperty('affected_customers');
    expect(typeof res.body.mrr_at_risk).toBe('number');
  });
});
