const Entry       = require('../models/Entry');
const ClientAlert = require('../models/ClientAlert');
const mongoose    = require('mongoose');
const { sendIncidentAlert } = require('./pushController');

const ALERT_TYPES = ['incident', 'health_safety', 'medical'];

function buildSummary(type, body) {
  switch (type) {
    case 'incident':      return `Incident – ${body.incident?.category || 'unspecified'} (${body.incident?.priority || ''})`;
    case 'health_safety': return `H&S – ${body.healthSafety?.hazardType || 'hazard reported'}`;
    case 'maintenance':   return `Maintenance – ${body.maintenance?.issueType || 'issue reported'} (${body.maintenance?.urgency || ''})`;
    case 'medical':       return `Medical – ${body.medical?.natureOfEmergency || 'first aid required'}`;
    default:              return type;
  }
}

// Calculate the next sequential occurrence number for a site
// Resets each "shift day" — defined as since the first on_duty entry today (or midnight if none)
async function getNextRefNumber(company, siteId) {
  try {
    // Start of calendar day (midnight)
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);

    // Find the first on_duty entry for this site today — this marks shift start
    const firstOnDuty = await Entry.findOne({
      company,
      site:      siteId,
      type:      'on_duty',
      timestamp: { $gte: midnight },
    }).sort({ timestamp: 1 });

    // Count from shift start (or midnight if no on_duty yet)
    const countFrom = firstOnDuty ? firstOnDuty.timestamp : midnight;

    const count = await Entry.countDocuments({
      company,
      site:      siteId,
      timestamp: { $gte: countFrom },
    });

    // Format as zero-padded 2-digit minimum, grows as needed: 01, 02 ... 99, 100
    const num = count + 1;
    return num < 10 ? '0' + num : String(num);
  } catch (e) {
    console.error('getNextRefNumber error:', e);
    return null;
  }
}

exports.createEntry = async (req, res) => {
  try {
    const officer  = req.user._id;
    const company  = req.user.companyId;
    const siteId   = req.body.site || null;

    // Calculate occurrence number before creating entry
    let refNumber = null;
    if (siteId) {
      refNumber = await getNextRefNumber(company, siteId);
    }

    const entry = await Entry.create({ ...req.body, officer, company, refNumber });

    if (entry.clientNotify) {
      await ClientAlert.create({
        company:   entry.company,
        site:      entry.site || null,
        entry:     entry._id,
        entryType: entry.type,
        priority:  entry.incident?.priority || entry.maintenance?.urgency || null,
        summary:   buildSummary(entry.type, req.body),
      });
    }

    // Fire push notification for incident / H&S / medical
    if (ALERT_TYPES.includes(entry.type)) {
      const populated = await Entry.findById(entry._id)
        .populate('site',    'name')
        .populate('officer', 'firstName lastName');
      sendIncidentAlert({
        companyId:    company,
        siteName:     populated?.site?.name     || 'Unknown site',
        officerName:  populated?.officer ? `${populated.officer.firstName} ${populated.officer.lastName}` : 'Officer',
        notes:        entry.notes || buildSummary(entry.type, req.body),
      }).catch(e => console.error('push error:', e));
    }

    res.status(201).json({ success: true, entry });
  } catch (err) {
    console.error('createEntry error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEntries = async (req, res) => {
  try {
    const company = req.user.companyId;
    const { date, site, type, limit = 100, skip = 0 } = req.query;
    const filter = { company };
    if (site)  filter.site = site;
    if (type)  filter.type = type;
    if (date) {
      const d     = new Date(date);
      const start = new Date(d.setHours(0, 0, 0, 0));
      const end   = new Date(d.setHours(23, 59, 59, 999));
      filter.timestamp = { $gte: start, $lte: end };
    }
    const entries = await Entry.find(filter, { images: 0 })
      .populate('officer', 'firstName lastName email')
      .populate('site',    'name')
      .sort({ timestamp: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    const total = await Entry.countDocuments(filter);
    res.json({ success: true, entries, total });
  } catch (err) {
    console.error('getEntries error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    const entry = await Entry.findOne({ _id: id, company: req.user.companyId })
      .populate('officer', 'firstName lastName email')
      .populate('site',    'name');
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, entry });
  } catch (err) {
    console.error('getEntry error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getAlerts = async (req, res) => {
  try {
    const company = req.user.companyId;
    const { unread, site, limit = 50, skip = 0 } = req.query;
    const filter = { company };
    if (unread === 'true') filter.read = false;
    if (site) filter.site = site;
    const alerts = await ClientAlert.find(filter)
      .populate({ path: 'entry', populate: { path: 'officer', select: 'firstName lastName' } })
      .populate('site', 'name')
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .skip(Number(skip));
    const unreadCount = await ClientAlert.countDocuments({ company, read: false });
    res.json({ success: true, alerts, unreadCount });
  } catch (err) {
    console.error('getAlerts error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.markAlertRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid alert ID' });
    const alert = await ClientAlert.findOneAndUpdate(
      { _id: id, company: req.user.companyId },
      { read: true, readAt: new Date(), readBy: req.user._id },
      { new: true }
    );
    if (!alert) return res.status(404).json({ success: false, message: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    console.error('markAlertRead error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/entries/alerts/:id/comment — officer or manager adds a comment
exports.addAlertComment = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: 'Comment text required' });
    const name = req.user.name || 'Officer';
    const from = req.user.role === 'COMPANY' ? 'manager' : 'officer';
    const alert = await ClientAlert.findOneAndUpdate(
      { _id: req.params.id, company: req.user.companyId },
      { $push: { comments: { from, name, text: text.trim() } } },
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/entries/alerts/:id/complete — officer marks as completed
exports.completeAlert = async (req, res) => {
  try {
    const { note } = req.body;
    const name = req.user.name || 'Officer';
    const update = {
      status:         'completed',
      completedAt:    new Date(),
      completedBy:    name,
      completionNote: note || '',
    };
    if (note?.trim()) {
      update.$push = { comments: { from: 'officer', name, text: '✓ Marked completed: ' + note.trim() } };
    }
    const alert = await ClientAlert.findOneAndUpdate(
      { _id: req.params.id, company: req.user.companyId },
      update,
      { new: true }
    );
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/entries/:id/resolve — ops manager resolves an entry
exports.resolveEntry = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id))
      return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    const { notes } = req.body;
    const resolvedBy = req.user.name || 'Manager';
    const entry = await Entry.findOneAndUpdate(
      { _id: id, company: req.user.companyId },
      { resolved: true, resolvedAt: new Date(), resolvedBy, resolutionNotes: notes || '' },
      { new: true }
    );
    if (!entry) return res.status(404).json({ success: false, message: 'Entry not found' });
    res.json({ success: true, entry });
  } catch (err) {
    console.error('resolveEntry error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/entries/archive — recurring issues summary
exports.getArchive = async (req, res) => {
  try {
    const company = req.user.companyId;
    const { site, type, days = 365 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));

    const filter = { company, timestamp: { $gte: since } };
    if (site) filter.site = site;
    if (type) filter.type = type;

    const entries = await Entry.find(filter, { notes: 1, type: 1, site: 1, timestamp: 1, resolved: 1, refNumber: 1 })
      .populate('site', 'name')
      .sort({ timestamp: -1 });

    // Group by type+site for recurring issue counts
    const groups = {};
    entries.forEach(e => {
      const key = `${e.type}::${e.site?._id||''}`;
      if (!groups[key]) groups[key] = {
        type: e.type,
        siteName: e.site?.name || '—',
        siteId: e.site?._id,
        count: 0,
        resolved: 0,
        latest: null,
        entries: [],
      };
      groups[key].count++;
      if (e.resolved) groups[key].resolved++;
      if (!groups[key].latest || e.timestamp > groups[key].latest) groups[key].latest = e.timestamp;
      groups[key].entries.push({ _id: e._id, timestamp: e.timestamp, notes: e.notes, resolved: e.resolved, refNumber: e.refNumber });
    });

    const summary = Object.values(groups)
      .filter(g => g.count > 0)
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, summary, total: entries.length });
  } catch (err) {
    console.error('getArchive error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};
