const Officer = require('../models/Officer');
const User    = require('../models/User');
const bcrypt  = require('bcryptjs');
const Entry   = require('../models/Entry');
const Site    = require('../models/Site');
const { sendOfficerWelcome, sendPasswordChanged } = require('../utils/email');

exports.getOfficers = async (req, res) => {
  try {
    const officers = await Officer.find({
      companyId: req.user.companyId,
      active: true
    })
    .populate('siteIds', 'name siteNumber')
    .sort({ lastName: 1 });
    res.json(officers);
  } catch (error) {
    console.error('Get officers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getMyProfile = async (req, res) => {
  try {
    const officer = await Officer.findOne({ userId: req.user.id, active: true })
      .populate('siteIds', 'name siteNumber');
    if (!officer) {
      const user = await User.findById(req.user.id);
      if (user) {
        const byEmail = await Officer.findOne({ email: user.email, active: true })
          .populate('siteIds', 'name siteNumber');
        if (byEmail) return res.json(byEmail);
      }
      return res.status(404).json({ error: 'Officer record not found' });
    }
    res.json(officer);
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createOfficer = async (req, res) => {
  try {
    const {
      firstName, lastName, siaNumber, siaType, siaExpiry,
      mobile, email, position, password, siteIds
    } = req.body;

    if (!firstName || !lastName || !siaNumber) {
      return res.status(400).json({ error: 'firstName, lastName and siaNumber are required' });
    }

    const normalisedSiteIds = Array.isArray(siteIds) ? siteIds : (siteIds ? [siteIds] : []);

    let userId = null;
    if (email && password) {
      // Only block if this email is already in use within this company
      const existing = await User.findOne({ email: email.toLowerCase(), companyId: req.user.companyId });
      if (existing) return res.status(400).json({ error: 'Email already in use at this company' });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = new User({
        companyId: req.user.companyId,
        email:     email.toLowerCase(),
        passwordHash,
        role:      'OFFICER',
        name:      `${firstName} ${lastName}`
      });
      await user.save();
      userId = user._id;
    }

    const officer = new Officer({
      companyId: req.user.companyId,
      userId,
      siteIds:  normalisedSiteIds,
      firstName, lastName, siaNumber,
      siaType:  siaType || 'Door Supervisor',
      siaExpiry, mobile, email,
      position: position || 'Security Officer'
    });
    await officer.save();

    // Send welcome email if officer has a login account
    if (email && password) {
      try {
        // Fetch site names for the email
        const assignedSites = normalisedSiteIds.length
          ? await Site.find({ _id: { $in: normalisedSiteIds } }).select('name')
          : [];

        // Get company name
        const Company = require('../models/Company');
        const company = await Company.findById(req.user.companyId).select('name');

        sendOfficerWelcome({
          officerName: `${firstName} ${lastName}`,
          companyName: company?.name || 'Your company',
          email:       email.toLowerCase(),
          password:    password,
          sites:       assignedSites,
        }).catch(err => console.error('Officer welcome email error:', err));
      } catch (emailErr) {
        console.error('Officer email prep error:', emailErr);
      }
    }

    res.status(201).json(officer);
  } catch (error) {
    console.error('Create officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateOfficer = async (req, res) => {
  try {
    if (req.body.siteIds && !Array.isArray(req.body.siteIds)) {
      req.body.siteIds = [req.body.siteIds];
    }
    const officer = await Officer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true }
    ).populate('siteIds', 'name siteNumber');
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    res.json(officer);
  } catch (error) {
    console.error('Update officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.suspendOfficer = async (req, res) => {
  try {
    const officer = await Officer.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    officer.suspended = !officer.suspended;
    await officer.save();
    if (officer.userId) {
      await User.findByIdAndUpdate(officer.userId, { suspended: officer.suspended });
    }
    res.json({ officer, suspended: officer.suspended });
  } catch (error) {
    console.error('Suspend officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resetOfficerPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const officer = await Officer.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    if (!officer.userId) return res.status(400).json({ error: 'Officer has no login account.' });
    const user = await User.findById(officer.userId);
    if (!user) return res.status(404).json({ error: 'Officer login account not found' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    if (user.email) {
      const Company = require('../models/Company');
      const company = await Company.findById(req.user.companyId).select('name');
      sendPasswordChanged({
        name:        `${officer.firstName} ${officer.lastName}`,
        email:       user.email,
        newPassword: newPassword,
        companyName: company?.name || 'Your company',
      }).catch(err => console.error('Password changed email error:', err));
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset officer password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deactivateOfficer = async (req, res) => {
  try {
    const officer = await Officer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { active: false },
      { new: true }
    );
    if (!officer) return res.status(404).json({ error: 'Officer not found' });
    res.json({ message: 'Officer deactivated' });
  } catch (error) {
    console.error('Deactivate officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOfficerStatus = async (req, res) => {
  try {
    const officer = await Officer.findOne({ _id: req.params.id, companyId: req.user.companyId });
    if (!officer) return res.status(404).json({ error: 'Officer not found' });

    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);

    const lastEntry = await Entry.findOne({
      officer:   officer.userId,
      type:      { $in: ['on_duty', 'off_duty'] },
      timestamp: { $gte: start, $lte: end }
    }).sort({ timestamp: -1 });

    res.json({
      officerId: officer._id,
      name:      `${officer.firstName} ${officer.lastName}`,
      status:    lastEntry ? lastEntry.type : officer.status,
      lastEntry: lastEntry || null
    });
  } catch (error) {
    console.error('Get officer status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
