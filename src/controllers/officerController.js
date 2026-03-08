const Officer = require('../models/Officer');
const User = require('../models/User');
const bcrypt = require('bcryptjs');
const Entry = require('../models/Entry');

exports.getOfficers = async (req, res) => {
  try {
    const officers = await Officer.find({
      companyId: req.user.companyId,
      active: true
    }).sort({ lastName: 1 });

    res.json(officers);
  } catch (error) {
    console.error('Get officers error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createOfficer = async (req, res) => {
  try {
    const {
      firstName, lastName, siaNumber, siaType, siaExpiry,
      mobile, email, position, password
    } = req.body;

    if (!firstName || !lastName || !siaNumber) {
      return res.status(400).json({ error: 'firstName, lastName and siaNumber are required' });
    }

    // Create user account for officer login
    let userId = null;
    if (email && password) {
      const existing = await User.findOne({ email: email.toLowerCase() });
      if (existing) {
        return res.status(400).json({ error: 'Email already in use' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const user = new User({
        companyId: req.user.companyId,
        email: email.toLowerCase(),
        passwordHash,
        role: 'OFFICER',
        name: `${firstName} ${lastName}`
      });
      await user.save();
      userId = user._id;
    }

    const officer = new Officer({
      companyId: req.user.companyId,
      userId,
      firstName,
      lastName,
      siaNumber,
      siaType: siaType || 'Door Supervisor',
      siaExpiry,
      mobile,
      email,
      position: position || 'Security Officer'
    });

    await officer.save();
    res.status(201).json(officer);
  } catch (error) {
    console.error('Create officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateOfficer = async (req, res) => {
  try {
    const officer = await Officer.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true }
    );

    if (!officer) {
      return res.status(404).json({ error: 'Officer not found' });
    }

    res.json(officer);
  } catch (error) {
    console.error('Update officer error:', error);
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

    if (!officer) {
      return res.status(404).json({ error: 'Officer not found' });
    }

    res.json({ message: 'Officer deactivated' });
  } catch (error) {
    console.error('Deactivate officer error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getOfficerStatus = async (req, res) => {
  try {
    const officer = await Officer.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    });

    if (!officer) {
      return res.status(404).json({ error: 'Officer not found' });
    }

    // Get last duty entry for today to compute live status
    const today = new Date().toISOString().split('T')[0];
    const lastEntry = await Entry.findOne({
      officerId: officer._id,
      type: { $in: ['on_duty', 'off_duty'] },
      shiftDate: today
    }).sort({ timestamp: -1 });

    const liveStatus = lastEntry ? lastEntry.type : officer.status;

    res.json({
      officerId: officer._id,
      name: `${officer.firstName} ${officer.lastName}`,
      status: liveStatus,
      lastEntry: lastEntry || null
    });
  } catch (error) {
    console.error('Get officer status error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
