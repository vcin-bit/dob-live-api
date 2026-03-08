const Entry       = require('../models/Entry');
const ClientAlert  = require('../models/ClientAlert');
const Officer      = require('../models/Officer');
const Site         = require('../models/Site');

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */

/** Build a plain-English headline for the client alert card */
function buildHeadline(type, data = {}) {
  const labels = {
    incident:     'Incident',
    health_safety:'Health & Safety',
    maintenance:  'Maintenance',
    medical:      'Medical / First Aid',
    on_duty:      'Officer On Duty',
    off_duty:     'Officer Off Duty',
    patrol_start: 'Patrol Started',
    patrol_end:   'Patrol Completed',
    observation:  'Observation',
    vehicle:      'Vehicle Check',
    handover:     'Post Handover',
    cctv_patrol:  'CCTV Patrol',
  };
  const base = labels[type] || type;
  if (type === 'incident' && data.category) {
    return `${base} — ${data.category}${data.priority ? ` (${data.priority})` : ''}`;
  }
  if (type === 'health_safety' && data.hazardType) return `${base} — ${data.hazardType}`;
  if (type === 'maintenance'   && data.issueType)  return `${base} — ${data.issueType}`;
  if (type === 'medical'       && data.nature)     return `${base} — ${data.nature}`;
  return base;
}

/* ─────────────────────────────────────────────────────────────
   POST /api/entries
   Create a new entry. If clientNotify is true, also write a
   ClientAlert so the client portal can surface it immediately.
───────────────────────────────────────────────────────────── */
exports.createEntry = async (req, res) => {
  try {
    const user = req.user;  // set by auth middleware

    const {
      type, notes, clientNotify = false,
      officerId, officerName, officerEmail, officerSia,
      siteId, timestamp, shiftDate,
      entryData = {},
      location,
    } = req.body;

    if (!type) return res.status(400).json({ error: 'Entry type is required' });

    // Resolve companyId — from officer record or from authed user
    let companyId = user.companyId;
    let resolvedOfficerId = officerId;

    if (!companyId && officerId) {
      try {
        const officer = await Officer.findById(officerId).lean();
        if (officer) companyId = officer.companyId;
      } catch (_) {}
    }

    // Build and save the entry
    const entry = await Entry.create({
      type,
      notes,
      clientNotify,
      officerId:    resolvedOfficerId || null,
      officerName:  officerName  || user.name  || '',
      officerEmail: officerEmail || user.email || '',
      officerSia:   officerSia   || '',
      siteId:       siteId       || null,
      companyId:    companyId    || null,
      entryData,
      location:     location     || null,
      timestamp:    timestamp ? new Date(timestamp) : new Date(),
      shiftDate:    shiftDate    || new Date().toISOString().split('T')[0],
    });

    // ── Write ClientAlert if flagged ──────────────────────────────
    if (clientNotify) {
      try {
        let siteName = '';
        if (siteId) {
          const site = await Site.findById(siteId).lean();
          siteName = site?.name || '';
        }

        await ClientAlert.create({
          entryId:     entry._id,
          companyId:   companyId || null,
          siteId:      siteId    || null,
          siteName,
          entryType:   type,
          officerName: officerName  || user.name  || '',
          officerSia:  officerSia   || '',
          headline:    buildHeadline(type, entryData),
          notes:       notes || '',
          alertData: {
            category:  entryData.category  || '',
            priority:  entryData.priority  || '',
            hazardType:entryData.hazardType || '',
            issueType: entryData.issueType  || '',
            nature:    entryData.nature     || '',
            vrm:       entryData.vrm        || '',
          },
          timestamp: entry.timestamp,
        });
      } catch (alertErr) {
        // Alert creation failing must not break the entry save
        console.error('ClientAlert creation error:', alertErr.message);
      }
    }

    res.status(201).json(entry);

  } catch (err) {
    console.error('createEntry error:', err);
    res.status(500).json({ error: 'Failed to save entry' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/entries
   Returns entries for the authed user.
   Officer: their own entries for the day.
   Company / Ops: all entries for their company, filterable.
───────────────────────────────────────────────────────────── */
exports.getEntries = async (req, res) => {
  try {
    const user  = req.user;
    const query = {};

    // Date filter (YYYY-MM-DD)
    if (req.query.date) query.shiftDate = req.query.date;

    // Site filter
    if (req.query.siteId) query.siteId = req.query.siteId;

    if (user.role === 'OFFICER') {
      // Officers only see their own entries
      query.officerEmail = user.email;
    } else {
      // Company / Ops see all entries for their company
      if (user.companyId) query.companyId = user.companyId;
    }

    // SUPER_ADMIN sees everything (no extra filter)

    const entries = await Entry.find(query)
      .sort({ timestamp: -1 })
      .limit(500)
      .lean();

    res.json(entries);

  } catch (err) {
    console.error('getEntries error:', err);
    res.status(500).json({ error: 'Failed to fetch entries' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/entries/alerts
   Client portal alert feed — all clientNotify entries for the
   company, most recent first.
   Also accessible to COMPANY / OPS roles for the ops manager.
───────────────────────────────────────────────────────────── */
exports.getAlerts = async (req, res) => {
  try {
    const user = req.user;

    const query = {};
    if (user.companyId) query.companyId = user.companyId;
    if (req.query.siteId) query.siteId  = req.query.siteId;
    if (req.query.unread === 'true') query.read = false;

    // Date range — defaults to last 30 days
    const since = req.query.since
      ? new Date(req.query.since)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    query.timestamp = { $gte: since };

    const alerts = await ClientAlert.find(query)
      .sort({ timestamp: -1 })
      .limit(200)
      .lean();

    res.json(alerts);

  } catch (err) {
    console.error('getAlerts error:', err);
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
};

/* ─────────────────────────────────────────────────────────────
   PATCH /api/entries/alerts/:id/read
   Mark a single alert as read
───────────────────────────────────────────────────────────── */
exports.markAlertRead = async (req, res) => {
  try {
    const alert = await ClientAlert.findByIdAndUpdate(
      req.params.id,
      { read: true, readAt: new Date() },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
};

/* ─────────────────────────────────────────────────────────────
   GET /api/entries/:id
───────────────────────────────────────────────────────────── */
exports.getEntry = async (req, res) => {
  try {
    const entry = await Entry.findById(req.params.id).lean();
    if (!entry) return res.status(404).json({ error: 'Entry not found' });
    res.json(entry);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch entry' });
  }
};
