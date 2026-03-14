const PatrolChecklist = require('../models/PatrolChecklist');

// GET /api/patrol-checklist?siteId=xxx
exports.getChecklist = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const list = await PatrolChecklist.findOne({ companyId: req.user.companyId, siteId });
    res.json(list || { checkpoints: [] });
  } catch (err) {
    console.error('getChecklist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// PUT /api/patrol-checklist?siteId=xxx
// Body: { checkpoints: [{name, description, order}] }
exports.saveChecklist = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const { checkpoints } = req.body;
    if (!Array.isArray(checkpoints)) return res.status(400).json({ error: 'checkpoints array required' });

    const list = await PatrolChecklist.findOneAndUpdate(
      { companyId: req.user.companyId, siteId },
      { companyId: req.user.companyId, siteId, checkpoints },
      { upsert: true, new: true }
    );
    res.json(list);
  } catch (err) {
    console.error('saveChecklist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/patrol-checklist/flag?siteId=xxx&checkpointId=xxx
// Called when an incident/observation is logged near a checkpoint
exports.flagCheckpoint = async (req, res) => {
  try {
    const { siteId, checkpointId } = req.query;
    if (!siteId || !checkpointId) return res.status(400).json({ error: 'siteId and checkpointId required' });
    const list = await PatrolChecklist.findOne({ companyId: req.user.companyId, siteId });
    if (!list) return res.status(404).json({ error: 'Checklist not found' });
    const cp = list.checkpoints.id(checkpointId);
    if (!cp) return res.status(404).json({ error: 'Checkpoint not found' });
    cp.riskCount  += 1;
    cp.lastFlagged = new Date();
    await list.save();
    res.json({ success: true, checkpoint: cp });
  } catch (err) {
    console.error('flagCheckpoint error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
