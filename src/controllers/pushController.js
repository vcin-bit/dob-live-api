const webpush           = require('web-push');
const PushSubscription  = require('../models/PushSubscription');

webpush.setVapidDetails(
  'mailto:admin@doblive.co.uk',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// POST /api/push/subscribe
exports.subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth)
      return res.status(400).json({ error: 'Invalid subscription object' });

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { companyId: req.user.companyId, userId: req.user._id, endpoint, keys },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/push/vapidPublicKey
exports.getVapidKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
};

// Internal helper — called by entryController on incident
exports.sendIncidentAlert = async ({ companyId, siteName, officerName, notes }) => {
  try {
    const subs = await PushSubscription.find({ companyId });
    if (!subs.length) return;

    const payload = JSON.stringify({
      title: `⚠️ Incident — ${siteName}`,
      body:  `${officerName}: ${notes || 'Incident logged'}`,
      icon:  '/icon-192.png',
      badge: '/icon-192.png',
      tag:   'incident',
    });

    await Promise.allSettled(subs.map(async sub => {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      } catch (err) {
        // Remove expired subscriptions
        if (err.statusCode === 410 || err.statusCode === 404) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    }));
  } catch (err) {
    console.error('sendIncidentAlert error:', err);
  }
};
