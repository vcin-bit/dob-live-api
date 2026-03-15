const CompanyPolicy = require('../models/CompanyPolicy');

exports.get = async (req, res) => {
  try {
    const doc = await CompanyPolicy.findOne({ companyId: req.user.companyId });
    res.json({ success: true, policy: doc || null });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

exports.save = async (req, res) => {
  try {
    const { sections } = req.body;
    if (!sections) return res.status(400).json({ error: 'sections required' });
    const doc = await CompanyPolicy.findOneAndUpdate(
      { companyId: req.user.companyId },
      { companyId: req.user.companyId, sections, updatedBy: req.user._id },
      { upsert: true, new: true }
    );
    res.json({ success: true, policy: doc });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
