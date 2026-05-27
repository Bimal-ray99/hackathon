process.env.GEMINI_API_KEY = 'dummy_key';
process.env.CORAL_API_URL = 'http://localhost:3001';

import request from 'supertest';
import { app } from '../src/index';

describe('Backend API', () => {
  it('GET /health returns 200 OK', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
});
