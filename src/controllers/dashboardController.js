const Entry   = require('../models/Entry');
const Officer = require('../models/Officer');
const Site    = require('../models/Site');

function todayRange() {
  const start = new Date(); start.setHours(0, 0, 0, 0);
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  return { start, end };
}

function weekRange() {
  const end   = new Date(); end.setHours(23, 59, 59, 999);
  const start = new Date(end); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
  return { start, end };
}

exports.getDashboard = async (req, res) => {
  try {
    const company = req.user.companyId;
    const { start, end }     = todayRange();
    const { start: wStart, end: wEnd } = weekRange();

    const [todaysEntries, weekEntries, officers, sites] = await Promise.all([
      Entry.find({ company, timestamp: { $gte: start, $lte: end } })
        .populate('officer', 'firstName lastName')
        .populate('site', 'name siteNumber'),
      Entry.find({ company, timestamp: { $gte: wStart, $lte: wEnd } })
        .select('type site timestamp'),
      Officer.find({ companyId: company, active: true }),
      Site.find({ companyId: company, status: 'active' }),
    ]);

    const totalCount    = todaysEntries.length;
    const incidentCount = todaysEntries.filter(e => e.type === 'incident').length;
    const patrolCount   = todaysEntries.filter(e => e.type === 'patrol_end').length;

    const rosterEntries = await Promise.all(officers.map(async (officer) => {
      const lastDutyEntry = await Entry.findOne({
        officer:   officer.userId,
        type:      { $in: ['on_duty', 'off_duty'] },
        timestamp: { $gte: start, $lte: end }
      }).sort({ timestamp: -1 }).populate('site', 'name');
      return {
        officerId:   officer._id,
        name:        `${officer.firstName} ${officer.lastName}`,
        siaNumber:   officer.siaNumber,
        status:      lastDutyEntry ? lastDutyEntry.type : 'off_duty',
        site:        lastDutyEntry?.site?.name || null,
        lastEntryAt: lastDutyEntry?.timestamp  || null,
      };
    }));
    const activeOfficerCount = rosterEntries.filter(o => o.status === 'on_duty').length;

    const siteStatuses = sites.map((site) => {
      const siteEntries = todaysEntries.filter(e => String(e.site?._id || e.site) === String(site._id));
      const lastEntry   = siteEntries.sort((a,b) => b.timestamp - a.timestamp)[0];
      const incCount    = siteEntries.filter(e => e.type === 'incident').length;
      return {
        siteId:        site._id,
        name:          site.name,
        siteNumber:    site.siteNumber,
        lastActivity:  lastEntry ? lastEntry.timestamp : null,
        lastEntryType: lastEntry ? lastEntry.type      : null,
        incidentCount: incCount,
        todayCount:    siteEntries.length,
      };
    });

    const dayLabels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      dayLabels.push(d.toISOString().split('T')[0]);
    }

    const weekBySite = sites.map(site => {
      const siteWeek = weekEntries.filter(e => String(e.site) === String(site._id));
      const days = dayLabels.map(label => {
        const dayEntries = siteWeek.filter(e => e.timestamp.toISOString().split('T')[0] === label);
        return {
          date:      label,
          total:     dayEntries.length,
          incidents: dayEntries.filter(e => e.type === 'incident').length,
          patrols:   dayEntries.filter(e => e.type === 'patrol_end').length,
        };
      });
      return {
        siteId:        site._id,
        name:          site.name,
        weekTotal:     siteWeek.length,
        weekIncidents: siteWeek.filter(e => e.type === 'incident').length,
        weekPatrols:   siteWeek.filter(e => e.type === 'patrol_end').length,
        days,
      };
    });

    res.json({
      date:            new Date().toISOString().split('T')[0],
      activeOfficers:  activeOfficerCount,
      totalOfficers:   officers.length,
      todayEntryCount: totalCount,
      incidentCount,
      patrolCount,
      siteStatuses,
      weekBySite,
      dayLabels,
      roster:          rosterEntries,
      recentEntries:   todaysEntries.slice(0, 20),
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
