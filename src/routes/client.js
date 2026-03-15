const express      = require('express');
const router       = express.Router();
const jwt          = require('jsonwebtoken');
const Site         = require('../models/Site');
const Entry        = require('../models/Entry');
const ClientAlert  = require('../models/ClientAlert');

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

/* ══ POST /api/client/auth ══ */
router.post('/auth', async (req, res) => {
  try {
    const { pin, siteId } = req.body;
    if (!pin || !siteId) return res.status(400).json({ error: 'PIN and siteId are required' });
    const site = await Site.findById(siteId).lean();
    if (!site)                     return res.status(404).json({ error: 'Site not found' });
    if (!site.clientPortalEnabled) return res.status(403).json({ error: 'Client access not enabled' });
    if (!site.clientPin)           return res.status(403).json({ error: 'No PIN set for this site' });
    if (String(site.clientPin) !== String(pin)) return res.status(401).json({ message: 'Incorrect PIN' });
    const token = jwt.sign(
      { siteId: site._id, siteName: site.name, role: 'CLIENT', client: site.client },
      process.env.JWT_SECRET,
      { expiresIn: '12h' }
    );
    res.json({ token, site: { id: site._id, name: site.name, client: site.client } });
  } catch (err) {
    console.error('Client auth error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ GET /api/client/site-info ══ */
router.get('/site-info', async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const site = await Site.findById(siteId).select('name client clientPortalEnabled').lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ site });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ GET /api/client/alerts — all clientNotify alerts for this site ══ */
router.get('/alerts', clientAuth, async (req, res) => {
  try {
    const siteId = req.clientSite.siteId;
    const { status } = req.query;
    const filter = { site: siteId };
    if (status) filter.status = status;

    const alerts = await ClientAlert.find(filter)
      .populate({
        path: 'entry',
        populate: { path: 'officer', select: 'name firstName lastName' }
      })
      .populate('site', 'name')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({ success: true, alerts });
  } catch (err) {
    console.error('Client alerts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ POST /api/client/alerts/:id/acknowledge ══ */
router.post('/alerts/:id/acknowledge', clientAuth, async (req, res) => {
  try {
    const { comment, clientName } = req.body;
    const name = clientName || req.clientSite.client || 'Client';
    const update = {
      status:         'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: name,
      read:           true,
      readAt:         new Date(),
    };
    if (comment?.trim()) {
      update.$push = { comments: { from: 'client', name, text: comment.trim() } };
    }
    const alert = await ClientAlert.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ POST /api/client/alerts/:id/comment — client adds a comment ══ */
router.post('/alerts/:id/comment', clientAuth, async (req, res) => {
  try {
    const { text, clientName } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });
    const name = clientName || req.clientSite.client || 'Client';
    const alert = await ClientAlert.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { from: 'client', name, text: text.trim() } } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ GET /api/client/summary ══ */
router.get('/summary', clientAuth, async (req, res) => {
  try {
    const siteId = req.clientSite.siteId;
    const start = new Date(); start.setHours(0,0,0,0);
    const end   = new Date(); end.setHours(23,59,59,999);
    const entries = await Entry.find({ site: siteId, timestamp: { $gte: start, $lte: end } }).lean();
    res.json({
      totalEntries:     entries.length,
      totalIncidents:   entries.filter(e => e.type === 'incident').length,
      patrolsCompleted: entries.filter(e => e.type === 'patrol_end').length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
/* ══ POST /api/client/tasks — client creates a task ══ */
const ClientTask = require('../models/ClientTask');

router.post('/tasks', clientAuth, async (req, res) => {
  try {
    const { title, description, priority } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });

    const siteId = req.clientSite.siteId;
    const site   = await Site.findById(siteId).select('name companyId').lean();
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const task = await ClientTask.create({
      companyId:       site.companyId,
      siteId,
      siteName:        site.name,
      createdByClient: true,
      clientName:      req.clientSite.client || 'Client',
      title,
      description:     description || '',
      priority:        priority || 'amber',
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('client createTask error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/* ══ GET /api/client/tasks — client views their tasks ══ */
router.get('/tasks', clientAuth, async (req, res) => {
  try {
    const siteId = req.clientSite.siteId;
    const tasks  = await ClientTask.find({ siteId }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});
