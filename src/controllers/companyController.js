const Company = require('../models/Company');

exports.getProfile = async (req, res) => {
  try {
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    res.json(company);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { name, address, companyNumber, website, mainTel, managerMobile } = req.body;
    const company = await Company.findById(req.user.companyId);
    if (!company) return res.status(404).json({ error: 'Company not found' });
    if (name)          company.name          = name;
    if (address)       company.address       = address;
    if (companyNumber) company.companyNumber = companyNumber;
    if (website)       company.website       = website;
    if (mainTel)       company.mainTel       = mainTel;
    if (managerMobile) company.managerMobile = managerMobile;
    await company.save();
    res.json(company);
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
