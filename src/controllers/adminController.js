const Company = require('../models/Company');
const User = require('../models/User');
const Officer = require('../models/Officer');
const Entry = require('../models/Entry');
const bcrypt = require('bcryptjs');

exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json(companies);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const {
      name, slug, tier, trialDays,
      managerName, managerEmail, managerPassword
    } = req.body;

    if (!name || !slug || !managerEmail || !managerPassword) {
      return res.status(400).json({ error: 'name, slug, managerEmail and managerPassword are required' });
    }

    const existingCompany = await Company.findOne({ slug });
    if (existingCompany) {
      return res.status(400).json({ error: 'Slug already in use' });
    }

    const existingUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ error: 'Manager email already in use' });
    }

    const company = new Company({
      name,
      slug,
      tier: tier || 'starter',
      status: 'trial',
      trialDays: trialDays || 60,
      billingStart: new Date().toISOString().split('T')[0]
    });
    await company.save();

    const passwordHash = await bcrypt.hash(managerPassword, 12);
    const manager = new User({
      companyId: company._id,
      email: managerEmail.toLowerCase(),
      passwordHash,
      role: 'COMPANY',
      name: managerName || 'Operations Manager'
    });
    await manager.save();

    res.status(201).json({
      company,
      manager: {
        id: manager._id,
        email: manager.email,
        name: manager.name,
        role: manager.role
      }
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const [totalCompanies, totalOfficers, totalEntries] = await Promise.all([
      Company.countDocuments(),
      Officer.countDocuments({ active: true }),
      Entry.countDocuments()
    ]);

    const today = new Date().toISOString().split('T')[0];
    const todayEntries = await Entry.countDocuments({ shiftDate: today });

    res.json({
      totalCompanies,
      totalOfficers,
      totalEntries,
      todayEntries
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
