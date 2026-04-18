export default {
  async scheduled(event, env, ctx) {
    const res = await fetch('https://dob-live-api.onrender.com/api/shifts/expire', {
      method: 'POST',
      headers: { 'x-cron-secret': env.CRON_SECRET, 'Content-Type': 'application/json' }
    });
    const data = await res.json();
    console.log('Shift expiry:', JSON.stringify(data));
  }
};
