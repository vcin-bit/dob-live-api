const express = require('express');
const router  = express.Router();
const jwt     = require('jsonwebtoken');
const Site    = require('../models/Site');
const Entry   = require('../models/Entry');

/* ── helpers ── */
function todayRange() {
  const start = new Date(); start.setHours(0,0,0,0);
  const end   = new Date(); end.setHours(23,59,59,999);
  return { start, end };
}

function clientAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorised' });
  try {
    req.clientSite = jwt.verify(auth.slice(7), process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
} 

/* ══════════════════════════════════════════
   GET /api/client/site-info?site=:siteId
══════════════════════════════════════════ */
router.get('/site-info', async (req, res) => {
  try {
    const { site: siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const site = await Site.findById(siteId).select('name clientPortalEnabled').lean();
    if (!site || !site.clientPortalEnabled) return res.status(404).json({ error: 'Not found' });
    res.json({ name: site.name });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══════════════════════════════════════════
   POST /api/client/auth
   Body: { pin, siteId }
══════════════════════════════════════════ */
router.post('/auth', async (req, res) => {
  try {
    const { pin, siteId } = req.body;
    if (!pin || !siteId) return res.status(400).json({ error: 'PIN and siteId are required' });

    const site = await Site.findById(siteId).lean();
    if (!site)                      return res.status(404).json({ error: 'Site not found' });
    if (!site.clientPortalEnabled)  return res.status(403).json({ error: 'Client access is not enabled for this site' });
    if (!site.clientPin)            return res.status(403).json({ error: 'No PIN has been set for this site' });
    if (String(site.clientPin) !== String(pin)) return res.status(401).json({ message: 'Incorrect PIN — please try again' });

    const token = jwt.sign(
      { siteId: site._id, siteName: site.name, role: 'CLIENT' },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );

    res.json({ token, site: { id: site._id, name: site.name, client: site.client } });
  } catch (err) {
    console.error('Client auth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══════════════════════════════════════════
   GET /api/client/alerts
══════════════════════════════════════════ */
router.get('/alerts', clientAuth, async (req, res) => {
  try {
    const { start, end } = todayRange();
    const alerts = await Entry.find({
      siteId:       req.clientSite.siteId,
      clientNotify: true,
      createdAt:    { $gte: start, $lte: end }
    })
    .sort({ createdAt: -1 })
    .lean();

    res.json({ alerts });
  } catch (err) {
    console.error('Client alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══════════════════════════════════════════
   GET /api/client/summary
══════════════════════════════════════════ */
router.get('/summary', clientAuth, async (req, res) => {
  try {
    const { start, end } = todayRange();
    const entries = await Entry.find({
      siteId:    req.clientSite.siteId,
      createdAt: { $gte: start, $lte: end }
    }).lean();

    const totalEntries      = entries.length;
    const totalIncidents    = entries.filter(e => e.type === 'incident').length;
    const patrolsCompleted  = entries.filter(e => e.type === 'patrol_end').length;

    const onDutyEntries = entries.filter(e => e.type === 'on_duty');
    const activeOfficers = [...new Map(
      onDutyEntries.map(e => [String(e.officerId), {
        name:      e.officerName || '—',
        sia:       e.officerSia  || '—',
        officerId: e.officerId
      }])
    ).values()];

    const HIGHLIGHT_TYPES = ['incident', 'observation', 'health_safety', 'medical', 'patrol_end'];
    const highlights = entries
      .filter(e => HIGHLIGHT_TYPES.includes(e.type))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10)
      .map(e => ({
        type:      e.type,
        notes:     e.notes || e.description || '',
        createdAt: e.createdAt
      }));

    res.json({ totalEntries, totalIncidents, patrolsCompleted, activeOfficers, highlights });
  } catch (err) {
    console.error('Client summary error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
