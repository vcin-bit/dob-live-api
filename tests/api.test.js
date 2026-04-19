const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const API = 'https://dob-live-api.onrender.com';

describe('API smoke tests', () => {
  it('GET /health returns 200 with status field', async () => {
    const res = await fetch(`${API}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.status, 'response should have a status field');
  });

  it('GET /api/shifts without auth returns 401', async () => {
    const res = await fetch(`${API}/api/shifts`);
    assert.equal(res.status, 401);
  });

  it('GET /api/logs without auth returns 401', async () => {
    const res = await fetch(`${API}/api/logs`);
    assert.equal(res.status, 401);
  });

  it('GET /debug-auth returns 404 (removed)', async () => {
    const res = await fetch(`${API}/debug-auth`);
    assert.equal(res.status, 404);
  });

  it('POST /api/shifts/expire without cron secret returns 401', async () => {
    const res = await fetch(`${API}/api/shifts/expire`, { method: 'POST' });
    assert.equal(res.status, 401);
  });

  it('GET /api/report/handover/pending without auth returns 401', async () => {
    const res = await fetch(`${API}/api/report/handover/pending`);
    assert.equal(res.status, 401);
  });
});
