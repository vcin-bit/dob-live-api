export default {
  async scheduled(event, env, ctx) {
    // Expire completed shifts
    try {
      const res = await fetch('https://dob-live-api.onrender.com/api/shifts/expire', {
        method: 'POST',
        headers: { 'x-cron-secret': env.CRON_SECRET, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      console.log('Shift expiry:', JSON.stringify(data));
    } catch (e) { console.error('Shift expiry failed:', e.message); }

    // Safety check monitoring
    try {
      const res = await fetch('https://dob-live-api.onrender.com/api/escalation/cron-check', {
        method: 'POST',
        headers: { 'x-cron-secret': env.CRON_SECRET, 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      console.log('Safety check:', JSON.stringify(data));
    } catch (e) { console.error('Safety check failed:', e.message); }
  }
};
