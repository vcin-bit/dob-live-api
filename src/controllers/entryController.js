const Entry       = require('../models/Entry');
const ClientAlert = require('../models/ClientAlert');
const mongoose    = require('mongoose');
const { uploadImage } = require('../utils/r2');

function buildSummary(type, body) {
  switch (type) {
    case 'incident':      return `Incident – ${body.incident?.category || 'unspecified'} (${body.incident?.priority || ''})`;
    case 'health_safety': return `H&S – ${body.healthSafety?.hazardType || 'hazard reported'}`;
    case 'maintenance':   return `Maintenance – ${body.maintenance?.issueType || 'issue reported'} (${body.maintenance?.urgency || ''})`;
    case 'medical':       return `Medical – ${body.medical?.natureOfEmergency || 'first aid required'}`;
    default:              return type;
  }
}

const MAX_IMAGES = 5;

async function processImages(images, entryType) {
  if (!images || !Array.isArray(images) || images.length === 0) return [];
  const limited = images.slice(0, MAX_IMAGES);
  const results = [];
  for (let i = 0; i < limited.length; i++) {
    const img = limited[i];
    if (!img.data) continue;
    try {
      const ext      = (img.mimeType || 'image/jpeg').split('/')[1] || 'jpg';
      const filename = `${entryType}-${Date.now()}-${i}.${ext}`;
      const url      = await uploadImage(img.data, img.mimeType || 'image/jpeg', filename);
      results.push({ url, caption: img.caption || '', mimeType: img.mimeType || 'image/jpeg' });
    } catch (err) {
      console.error(`Image upload error (${i}):`, err.message);
    }
  }
  return results;
}

exports.createEntry = async (req, res) => {
  try {
    const officer  = req.user._id;
    const company  = req.user.companyId;

    // Upload images to R2, replace base64 with URLs
    const rawImages = req.body.images || [];
    const images    = await processImages(rawImages, req.body.type || 'entry');

    const entry = await Entry.create({ ...req.body, officer, company, images });

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
    const entries = await Entry.find(filter)
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid entry ID' });
    }
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
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid alert ID' });
    }
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
