const Site = require('../models/Site');

exports.getSites = async (req, res) => {
  try {
    const sites = await Site.find({
      companyId: req.user.companyId,
      status: 'active'
    }).sort({ name: 1 });

    res.json(sites);
  } catch (error) {
    console.error('Get sites error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.createSite = async (req, res) => {
  try {
    const {
      name, siteNumber, address, city, client,
      geofenceLat, geofenceLng, geofenceRadius,
      escalationContact1Name, escalationContact1Mobile,
      escalationContact2Name, escalationContact2Mobile,
      officerIds
    } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Site name is required' });
    }

    const site = new Site({
      companyId: req.user.companyId,
      name, siteNumber, address, city, client,
      geofenceLat, geofenceLng,
      geofenceRadius: geofenceRadius || 200,
      escalationContact1Name, escalationContact1Mobile,
      escalationContact2Name, escalationContact2Mobile,
      officerIds: officerIds || []
    });

    await site.save();
    res.status(201).json(site);
  } catch (error) {
    console.error('Create site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.updateSite = async (req, res) => {
  try {
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { $set: req.body },
      { new: true }
    );

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json(site);
  } catch (error) {
    console.error('Update site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.deactivateSite = async (req, res) => {
  try {
    const site = await Site.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { status: 'inactive' },
      { new: true }
    );

    if (!site) {
      return res.status(404).json({ error: 'Site not found' });
    }

    res.json({ message: 'Site deactivated' });
  } catch (error) {
    console.error('Deactivate site error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
