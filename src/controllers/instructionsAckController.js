const InstructionsAck  = require('../models/InstructionsAck');
const SiteInstructions = require('../models/SiteInstructions');

exports.acknowledge = async (req, res) => {
  try {
    const { siteId } = req.body;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const officerId   = req.user.officerId;
    const officerName = req.user.name || 'Officer';
    const companyId   = req.user.companyId;
    const instructions = await SiteInstructions.findOne({ siteId });
    if (!instructions) return res.status(404).json({ error: 'No instructions found' });
    await InstructionsAck.findOneAndUpdate(
      { companyId, siteId, officerId, instructionsVersion: instructions.updatedAt },
      { companyId, siteId, officerId, officerName, instructionsVersion: instructions.updatedAt, ackedAt: new Date() },
      { upsert: true, new: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('acknowledge error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStatus = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const officerId    = req.user.officerId;
    const instructions = await SiteInstructions.findOne({ siteId });
    if (!instructions) return res.json({ required: false, acked: false });
    const ack = await InstructionsAck.findOne({ siteId, officerId, instructionsVersion: instructions.updatedAt });
    res.json({ required: true, acked: !!ack, ackedAt: ack?.ackedAt || null });
  } catch (err) {
    console.error('getStatus error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getRecords = async (req, res) => {
  try {
    const { siteId } = req.query;
    const companyId  = req.user.companyId;
    const filter     = { companyId };
    if (siteId) filter.siteId = siteId;
    const acks = await InstructionsAck.find(filter).sort({ ackedAt: -1 }).limit(100);
    const grouped = {};
    acks.forEach(a => {
      const key = `${a.siteId}_${a.officerId}`;
      if (!grouped[key]) grouped[key] = a;
    });
    const siteIds      = [...new Set(acks.map(a => String(a.siteId)))];
    const instructions = await SiteInstructions.find({ siteId: { $in: siteIds } }).select('siteId updatedAt');
    const versionMap   = {};
    instructions.forEach(i => { versionMap[String(i.siteId)] = i.updatedAt; });
    const records = Object.values(grouped).map(a => ({
      officerName:         a.officerName,
      officerId:           a.officerId,
      siteId:              a.siteId,
      ackedAt:             a.ackedAt,
      instructionsVersion: a.instructionsVersion,
      isCurrent:           versionMap[String(a.siteId)]
                             ? Math.abs(new Date(versionMap[String(a.siteId)]) - new Date(a.instructionsVersion)) < 1000
                             : false,
    }));
    res.json({ success: true, records });
  } catch (err) {
    console.error('getRecords error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
