const Entry = require('../models/Entry');
const Officer = require('../models/Officer');

exports.createEntry = async (req, res) => {
  try {
    const { siteId, officerId, type, notes, locationLat, locationLng, locationW3W, photos, timestamp, shiftDate } = req.body;

    if (!siteId || !officerId || !type) {
      return res.status(400).json({ error: 'siteId, officerId and type are required' });
    }

    // Get officer details for denormalised fields
    const officer = await Officer.findById(officerId);
    const officerName = officer ? `${officer.lastName}, ${officer.firstName.charAt(0)}.` : '';
    const officerSia = officer ? `SIA-${officer.siaNumber.slice(-4)}` : '';

    const entry = new Entry({
      companyId: req.user.companyId,
      siteId,
      officerId,
      officerName,
      officerSia,
      type,
      notes: notes || '',
      locationLat,
      locationLng,
      locationW3W,
      photos: photos || [],
      timestamp: timestamp ? new Date(timestamp) : new Date(),
      shiftDate
    });

    await entry.save();

    // Update officer duty status if on_duty or off_duty entry
    if (type === 'on_duty' || type === 'off_duty') {
      await Officer.findByIdAndUpdate(officerId, { status: type });
    }

    res.status(201).json(entry);
  } catch (error) {
    console.error('Create entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEntries = async (req, res) => {
  try {
    const { siteId, date, type, officerId } = req.query;

    const filter = { companyId: req.user.companyId };

    if (siteId) filter.siteId = siteId;
    if (type) filter.type = type;
    if (officerId) filter.officerId = officerId;

    // Default to today if no date provided
    const targetDate = date || new Date().toISOString().split('T')[0];
    filter.shiftDate = targetDate;

    // Officers can only see their own entries
    if (req.user.role === 'OFFICER') {
      const officer = await Officer.findOne({ userId: req.user._id });
      if (officer) filter.officerId = officer._id;
    }

    const entries = await Entry.find(filter)
      .sort({ timestamp: -1 })
      .populate('siteId', 'name siteNumber')
      .populate('officerId', 'firstName lastName siaNumber');

    res.json(entries);
  } catch (error) {
    console.error('Get entries error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};

exports.getEntry = async (req, res) => {
  try {
    const entry = await Entry.findOne({
      _id: req.params.id,
      companyId: req.user.companyId
    })
      .populate('siteId', 'name siteNumber address')
      .populate('officerId', 'firstName lastName siaNumber');

    if (!entry) {
      return res.status(404).json({ error: 'Entry not found' });
    }

    res.json(entry);
  } catch (error) {
    console.error('Get entry error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
