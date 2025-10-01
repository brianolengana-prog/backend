const request = require('supertest');
const app = require('../src/app');

describe('health', () => {
  it('returns OK', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});


