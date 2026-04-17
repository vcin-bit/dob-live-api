// Keep-alive cron - ping the API every 14 minutes
// Add this as a Render Cron Job: node cron-keepalive.js
const https = require('https');
https.get('https://dob-live-api.onrender.com/health', (res) => {
  console.log('Keep-alive ping:', res.statusCode, new Date().toISOString());
}).on('error', (e) => {
  console.error('Ping failed:', e.message);
});
