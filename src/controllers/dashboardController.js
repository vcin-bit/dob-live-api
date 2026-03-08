const Entry   = require('../models/Entry');
const Officer = require('../models/Officer');
const Site    = require('../models/Site');

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

exports.getDashboard = async (req, res) => {
  try {
    const company = req.user.company;
    const { start, end } = todayRange();

    // Today's entries
    const todaysEntries = await Entry.find({
      company,
      timestamp: { $gte: start, $lte: end }
    });

    const totalCount    = todaysEntries.length;
    const incidentCount = todaysEntries.filter(e => e.type === 'incident').length;
    const patrolCount   = todaysEntries.filter(e => e.type === 'patrol_start').length;

    // Active officers — last duty entry today is on_duty
    const officers = await Officer.find({ companyId: company, active: true });
    let activeOfficerCount = 0;
    for (const officer of officers) {
      const lastDutyEntry = await Entry.findOne({
        officer:   officer.userId,
        type:      { $in: ['on_duty', 'off_duty'] },
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 });
      if (lastDutyEntry && lastDutyEntry.type === 'on_duty') {
        activeOfficerCount++;
      }
    }

    // Site statuses
    const sites = await Site.find({ companyId: company, status: 'active' });
    const siteStatuses = await Promise.all(sites.map(async (site) => {
      const lastEntry = await Entry.findOne({
        site:      site._id,
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 });
      return {
        siteId:        site._id,
        name:          site.name,
        siteNumber:    site.siteNumber,
        lastActivity:  lastEntry ? lastEntry.timestamp : null,
        lastEntryType: lastEntry ? lastEntry.type      : null
      };
    }));

    res.json({
      date:             new Date().toISOString().split('T')[0],
      activeOfficers:   activeOfficerCount,
      totalOfficers:    officers.length,
      todayEntryCount:  totalCount,
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
    const entries = await Entry.find({ company: req.user.company })
      .sort({ timestamp: -1 })
      .limit(50)
      .populate('site',    'name siteNumber')
      .populate('officer', 'firstName lastName');
    res.json(entries);
  } catch (error) {
    console.error('Feed error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
