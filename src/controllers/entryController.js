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

exports.createEntry = async (req, res) => {
  try {
    const officer  = req.user._id;
    const company  = req.user.companyId;
    const entry = await Entry.create({ ...req.body, officer, company });

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
