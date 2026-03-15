const PatrolChecklist = require('../models/PatrolChecklist');

exports.getChecklist = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });

    const companyId = req.user.companyId;
    let list = null;

    if (companyId) {
      list = await PatrolChecklist.findOne({ companyId, siteId });
    }

    if (!list) {
      list = await PatrolChecklist.findOne({ siteId });
    }

    res.json(list || { checkpoints: [] });
  } catch (err) {
    console.error('getChecklist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.saveChecklist = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const { checkpoints } = req.body;
    if (!Array.isArray(checkpoints)) return res.status(400).json({ error: 'checkpoints array required' });

    const companyId = req.user.companyId;
    const list = await PatrolChecklist.findOneAndUpdate(
      { companyId, siteId },
      { companyId, siteId, checkpoints },
      { upsert: true, new: true }
    );
    res.json(list);
  } catch (err) {
    console.error('saveChecklist error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.flagCheckpoint = async (req, res) => {
  try {
    const { siteId, checkpointId } = req.query;
    if (!siteId || !checkpointId) return res.status(400).json({ error: 'siteId and checkpointId required' });
    const list = await PatrolChecklist.findOne({ siteId });
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
