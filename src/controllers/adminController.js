const Company = require('../models/Company');
const User    = require('../models/User');
const Officer = require('../models/Officer');
const Site    = require('../models/Site');
const Entry   = require('../models/Entry');
const bcrypt  = require('bcryptjs');
const { sendCompanyWelcome } = require('../utils/email');

exports.getCompanies = async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    const enriched = await Promise.all(companies.map(async (c) => {
      const [siteCount, officerCount, manager] = await Promise.all([
        Site.countDocuments({ companyId: c._id }),
        Officer.countDocuments({ companyId: c._id, active: true }),
        User.findOne({ companyId: c._id, role: 'COMPANY' }).select('name email'),
      ]);
      return {
        ...c.toObject(),
        siteCount,
        officerCount,
        managerName:  manager?.name  || '',
        managerEmail: manager?.email || '',
        managerId:    manager?._id   || null,
      };
    }));
    res.json(enriched);
  } catch (error) {
    console.error('Get companies error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createCompany = async (req, res) => {
  try {
    const {
      name, slug, tier, trialDays,
      companyNumber, address, website, mainTel, managerMobile,
      managerName, managerEmail, managerPassword
    } = req.body;

    if (!name || !slug || !managerEmail || !managerPassword) {
      return res.status(400).json({ error: 'name, slug, managerEmail and managerPassword are required' });
    }

    const existingCompany = await Company.findOne({ slug });
    if (existingCompany) return res.status(400).json({ error: 'Slug already in use' });

    const existingUser = await User.findOne({ email: managerEmail.toLowerCase() });
    if (existingUser) return res.status(400).json({ error: 'Manager email already in use' });

    const company = new Company({
      name, slug,
      companyNumber, address, website, mainTel, managerMobile,
      tier: tier || 'starter',
      status: 'trial',
      trialDays: trialDays || 60,
      billingStart: new Date().toISOString().split('T')[0]
    });
    await company.save();

    const passwordHash = await bcrypt.hash(managerPassword, 12);
    const manager = new User({
      companyId: company._id,
      email:     managerEmail.toLowerCase(),
      passwordHash,
      role:      'COMPANY',
      name:      managerName || 'Operations Manager'
    });
    await manager.save();

    // Send welcome email (non-blocking — don't fail the request if email fails)
    sendCompanyWelcome({
      companyName:     name,
      tier:            tier || 'starter',
      managerName:     managerName || 'Operations Manager',
      managerEmail:    managerEmail.toLowerCase(),
      managerPassword: managerPassword,
    }).catch(err => console.error('Welcome email error:', err));

    res.status(201).json({
      company,
      manager: { id: manager._id, email: manager.email, name: manager.name, role: manager.role }
    });
  } catch (error) {
    console.error('Create company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, tier, status, companyNumber, address, website, mainTel, managerMobile } = req.body;
    const company = await Company.findById(id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (name)          company.name          = name;
    if (tier)          company.tier          = tier;
    if (status)        company.status        = status;
    if (companyNumber) company.companyNumber = companyNumber;
    if (address)       company.address       = address;
    if (website)       company.website       = website;
    if (mainTel)       company.mainTel       = mainTel;
    if (managerMobile) company.managerMobile = managerMobile;
    await company.save();
    res.json(company);
  } catch (error) {
    console.error('Update company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.suspendCompany = async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    company.status = company.status === 'suspended' ? 'active' : 'suspended';
    await company.save();
    res.json({ company, status: company.status });
  } catch (error) {
    console.error('Suspend company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await Company.findById(id);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    await Promise.all([
      User.deleteMany({ companyId: id }),
      Officer.deleteMany({ companyId: id }),
      Site.deleteMany({ companyId: id }),
      Entry.deleteMany({ companyId: id }),
    ]);
    await Company.findByIdAndDelete(id);
    res.json({ message: 'Company and all associated data deleted' });
  } catch (error) {
    console.error('Delete company error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.resetManagerPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const manager = await User.findOne({ companyId: req.params.id, role: 'COMPANY' });
    if (!manager) return res.status(404).json({ error: 'Manager not found' });
    manager.passwordHash = await bcrypt.hash(newPassword, 12);
    await manager.save();
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getStats = async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end   = new Date(); end.setHours(23, 59, 59, 999);
    const [totalCompanies, totalOfficers, totalEntries, totalSites, todayEntries] = await Promise.all([
      Company.countDocuments(),
      Officer.countDocuments({ active: true }),
      Entry.countDocuments(),
      Site.countDocuments(),
      Entry.countDocuments({ timestamp: { $gte: start, $lte: end } }),
    ]);
    res.json({ totalCompanies, totalOfficers, totalEntries, totalSites, todayEntries });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
