const ClientTask = require('../models/ClientTask');
const Site       = require('../models/Site');

// POST /api/tasks — client or ops manager creates a task
exports.createTask = async (req, res) => {
  try {
    const { siteId, title, description, priority } = req.body;
    if (!siteId || !title) return res.status(400).json({ error: 'siteId and title required' });

    const site = await Site.findById(siteId).select('name companyId');
    if (!site) return res.status(404).json({ error: 'Site not found' });

    const task = await ClientTask.create({
      companyId:       site.companyId,
      siteId,
      siteName:        site.name,
      createdByClient: req.user.role === 'CLIENT',
      clientName:      req.user.name || req.user.email || 'Client',
      title,
      description:     description || '',
      priority:        priority || 'amber',
    });

    res.status(201).json({ success: true, task });
  } catch (err) {
    console.error('createTask error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/tasks — ops manager gets all tasks for their company
exports.getTasks = async (req, res) => {
  try {
    const { status, siteId } = req.query;
    const filter = { companyId: req.user.companyId };
    if (status) filter.status = status;
    if (siteId) filter.siteId = siteId;
    const tasks = await ClientTask.find(filter).sort({ createdAt: -1 }).limit(100);
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// GET /api/tasks/officer — officer gets open/acknowledged tasks for their site
exports.getOfficerTasks = async (req, res) => {
  try {
    const { siteId } = req.query;
    if (!siteId) return res.status(400).json({ error: 'siteId required' });
    const tasks = await ClientTask.find({
      siteId,
      status: { $in: ['open', 'acknowledged'] },
    }).sort({ priority: 1, createdAt: -1 });
    res.json({ success: true, tasks });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/tasks/:id/acknowledge — officer acknowledges
exports.acknowledgeTask = async (req, res) => {
  try {
    const officerName = req.user.name || 'Officer';
    const task = await ClientTask.findByIdAndUpdate(
      req.params.id,
      { status: 'acknowledged', acknowledgedBy: officerName, acknowledgedAt: new Date() },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/tasks/:id/complete — officer completes
exports.completeTask = async (req, res) => {
  try {
    const { notes } = req.body;
    const officerName = req.user.name || 'Officer';
    const task = await ClientTask.findByIdAndUpdate(
      req.params.id,
      {
        status:          'completed',
        completedBy:     officerName,
        completedAt:     new Date(),
        completionNotes: notes || '',
      },
      { new: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, task });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
};
