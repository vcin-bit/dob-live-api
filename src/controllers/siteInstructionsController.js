const SiteInstructions = require('../models/SiteInstructions');

exports.get = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const doc = await SiteInstructions.findOne({ companyId: req.user.companyId, siteId });
    res.json({ success: true, instructions: doc || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.save = async (req, res) => {
  try {
    const { siteId, siteName, sections } = req.body;
    if (!siteId || !sections) return res.status(400).json({ error: 'siteId and sections required' });
    const doc = await SiteInstructions.findOneAndUpdate(
      { companyId: req.user.companyId, siteId },
      { companyId: req.user.companyId, siteId, siteName, sections, updatedBy: req.user._id },
      { upsert: true, new: true }
    );
    res.json({ success: true, instructions: doc });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
