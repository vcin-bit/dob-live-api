const Entry = require('../models/Entry');
const Officer = require('../models/Officer');
const Site = require('../models/Site');

exports.getDashboard = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const today = new Date().toISOString().split('T')[0];

    // Today's entries
    const todaysEntries = await Entry.find({ companyId, shiftDate: today });

    // Count by type
    const incidentCount = todaysEntries.filter(e => e.type === 'incident').length;
    const patrolCount = todaysEntries.filter(e => e.type === 'patrol_start').length;
    const totalCount = todaysEntries.length;

    // Active officers - those whose last on_duty/off_duty entry today is on_duty
    const officers = await Officer.find({ companyId, active: true });
    let activeOfficerCount = 0;

    for (const officer of officers) {
      const lastDutyEntry = await Entry.findOne({
        officerId: officer._id,
        type: { $in: ['on_duty', 'off_duty'] },
        shiftDate: today
      }).sort({ timestamp: -1 });

      if (lastDutyEntry && lastDutyEntry.type === 'on_duty') {
        activeOfficerCount++;
      }
    }

    // Site statuses
    const sites = await Site.find({ companyId, status: 'active' });
    const siteStatuses = await Promise.all(sites.map(async (site) => {
      const lastEntry = await Entry.findOne({
        siteId: site._id,
        shiftDate: today
      }).sort({ timestamp: -1 });

      return {
        siteId: site._id,
        name: site.name,
        siteNumber: site.siteNumber,
        lastActivity: lastEntry ? lastEntry.timestamp : null,
        lastEntryType: lastEntry ? lastEntry.type : null
      };
    }));

    res.json({
      date: today,
      activeOfficers: activeOfficerCount,
      totalOfficers: officers.length,
      todayEntryCount: totalCount,
      incidentCount,
      patrolCount,
      siteStatuses
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const entries = await Entry.find({ companyId: req.user.companyId })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('siteId', 'name siteNumber')
      .populate('officerId', 'firstName lastName');

    res.json(entries);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
