const HandoverBrief = require('../models/HandoverBrief');

exports.createBrief = async (req, res) => {
  try {
    const { siteId, notes, shiftSummary, incidents, patrols, totalEntries } = req.body;
    const officerId    = req.user.officerId;
    const outgoingName = req.user.name || 'Officer';
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const brief = await HandoverBrief.create({
      companyId:       req.user.companyId,
      siteId,
      outgoingOfficer: officerId,
      outgoingName,
      notes:           notes || '',
      shiftSummary:    shiftSummary || '',
      incidents:       incidents || 0,
      patrols:         patrols || 0,
      totalEntries:    totalEntries || 0,
    });
    res.status(201).json({ success: true, brief });
  } catch (err) {
    console.error('createBrief error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getLatest = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const brief = await HandoverBrief.findOne({
      companyId: req.user.companyId,
      siteId,
    }).sort({ createdAt: -1 });
    res.json({ success: true, brief: brief || null });
  } catch (err) {
    console.error('getLatest error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.acknowledge = async (req, res) => {
  try {
    const officerId    = req.user.officerId;
    const officerName  = req.user.name || 'Officer';
    const brief = await HandoverBrief.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { acknowledgedBy: officerId, acknowledgedAt: new Date(), acknowledgedName: officerName },
      { new: true }
    );
    if (!brief) return res.status(404).json({ error: 'Brief not found' });
    res.json({ success: true, brief });
  } catch (err) {
    console.error('acknowledge error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.listBriefs = async (req, res) => {
  try {
    const { siteId } = req.query;
    const filter = { companyId: req.user.companyId };
    if (siteId) filter.siteId = siteId;
    const briefs = await HandoverBrief.find(filter).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, briefs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
