export default {
  // Cron trigger — runs every 5 mins
  async scheduled(event, env, ctx) {
    await runChecks(env);
  },

  // HTTP trigger — for manual testing
  async fetch(request, env) {
    const results = await runChecks(env);
    return new Response(JSON.stringify(results, null, 2), {
      headers: { 'Content-Type': 'application/json' },
    });
  },
};

async function runChecks(env) {
  const results = { shift_expiry: null, safety_check: null };
  const headers = { 'Content-Type': 'application/json' };
  if (env.CRON_SECRET) headers['x-cron-secret'] = env.CRON_SECRET;

  // Expire completed shifts
  try {
    const res = await fetch('https://dob-live-api.onrender.com/api/shifts/expire', {
      method: 'POST', headers,
    });
    results.shift_expiry = await res.json();
    console.log('Shift expiry:', JSON.stringify(results.shift_expiry));
  } catch (e) {
    results.shift_expiry = { error: e.message };
    console.error('Shift expiry failed:', e.message);
  }

  // Safety check monitoring
  try {
    const res = await fetch('https://dob-live-api.onrender.com/api/escalation/cron-check', {
      method: 'POST', headers,
    });
    results.safety_check = await res.json();
    console.log('Safety check:', JSON.stringify(results.safety_check));
  } catch (e) {
    results.safety_check = { error: e.message };
    console.error('Safety check failed:', e.message);
  }

  return results;
}
