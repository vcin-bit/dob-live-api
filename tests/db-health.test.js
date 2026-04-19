const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

const SUPABASE_URL = 'https://bxesqjzkuredqzvepomn.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_ANON_KEY) {
  console.error('SUPABASE_ANON_KEY env var is required');
  process.exit(1);
}

async function query(table, selectParams = '') {
  const url = `${SUPABASE_URL}/rest/v1/${table}?${selectParams}`;
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      Prefer: 'count=exact',
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase query failed (${res.status}): ${body}`);
  }
  const count = parseInt(res.headers.get('content-range')?.split('/')[1] || '0', 10);
  const data = await res.json();
  return { data, count };
}

describe('Database health checks', () => {
  it('no ghost shifts older than 24 hours still marked ACTIVE', async () => {
    const cutoff = new Date(Date.now() - 24 * 3600000).toISOString();
    const { data } = await query(
      'shifts',
      `select=id,start_time,status&status=eq.ACTIVE&start_time=lt.${cutoff}`
    );
    assert.equal(
      data.length,
      0,
      `Found ${data.length} ghost shift(s) active for over 24h: ${JSON.stringify(data.map(s => s.id))}`
    );
  });

  it('no shifts with lowercase "completed" status (should be COMPLETED)', async () => {
    const { data } = await query(
      'shifts',
      'select=id,status&status=eq.completed'
    );
    assert.equal(
      data.length,
      0,
      `Found ${data.length} shift(s) with lowercase "completed" status: ${JSON.stringify(data.map(s => s.id))}`
    );
  });

  it('no occurrence logs with null officer_id', async () => {
    const { data } = await query(
      'occurrence_logs',
      'select=id,officer_id&officer_id=is.null'
    );
    assert.equal(
      data.length,
      0,
      `Found ${data.length} log(s) with no officer: ${JSON.stringify(data.map(l => l.id))}`
    );
  });
});
