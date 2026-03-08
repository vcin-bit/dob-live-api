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
    const company = req.user.companyId;   // ← fixed
    const { start, end } = todayRange();

    const todaysEntries = await Entry.find({
      company,
      timestamp: { $gte: start, $lte: end }
    }).populate('officer', 'firstName lastName')
      .populate('site', 'name siteNumber');

    const totalCount    = todaysEntries.length;
    const incidentCount = todaysEntries.filter(e => e.type === 'incident').length;
    const patrolCount   = todaysEntries.filter(e => e.type === 'patrol_end').length;

    // Active officers — last duty entry today is on_duty
    const officers = await Officer.find({ companyId: company, active: true });
    const rosterEntries = [];
    for (const officer of officers) {
      const lastDutyEntry = await Entry.findOne({
        officer:   officer.userId,
        type:      { $in: ['on_duty', 'off_duty'] },
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 }).populate('site', 'name');

      rosterEntries.push({
        officerId:   officer._id,
        name:        `${officer.firstName} ${officer.lastName}`,
        siaNumber:   officer.siaNumber,
        status:      lastDutyEntry ? lastDutyEntry.type : 'off_duty',
        site:        lastDutyEntry?.site?.name || null,
        lastEntryAt: lastDutyEntry?.timestamp  || null,
      });
    }
    const activeOfficerCount = rosterEntries.filter(o => o.status === 'on_duty').length;

    // Site statuses
    const sites = await Site.find({ companyId: company, status: 'active' });
    const siteStatuses = await Promise.all(sites.map(async (site) => {
      const lastEntry = await Entry.findOne({
        site:      site._id,
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 });
      const incCount = todaysEntries.filter(e => String(e.site?._id || e.site) === String(site._id) && e.type === 'incident').length;
      return {
        siteId:        site._id,
        name:          site.name,
        siteNumber:    site.siteNumber,
        lastActivity:  lastEntry ? lastEntry.timestamp : null,
        lastEntryType: lastEntry ? lastEntry.type      : null,
        incidentCount: incCount,
      };
    }));

    res.json({
      date:             new Date().toISOString().split('T')[0],
      activeOfficers:   activeOfficerCount,
      totalOfficers:    officers.length,
      todayEntryCount:  totalCount,
      incidentCount,
      patrolCount,
      siteStatuses,
      roster:           rosterEntries,
      recentEntries:    todaysEntries.slice(0, 20),
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getFeed = async (req, res) => {
  try {
    const entries = await Entry.find({ company: req.user.companyId })
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
