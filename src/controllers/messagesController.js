const User    = require('../models/User');
const Officer = require('../models/Officer');
const { sendOfficerMessage } = require('../utils/email');

exports.sendMessage = async (req, res) => {
  try {
    const { subject, body, recipientIds } = req.body;
    if (!subject || !body || !recipientIds?.length)
      return res.status(400).json({ error: 'subject, body and recipientIds required' });

    const company = req.user.companyId;
    const senderName = req.user.name || 'Your Operations Manager';

    // Fetch officers to get emails — verify they belong to this company
    const officers = await Officer.find({
      _id: { $in: recipientIds },
      companyId: company,
    });

    if (!officers.length)
      return res.status(404).json({ error: 'No matching officers found' });

    // Get user emails via userId
    const userIds = officers.map(o => o.userId).filter(Boolean);
    const users   = await User.find({ _id: { $in: userIds } }).select('email name');
    const emailMap = {};
    users.forEach(u => { emailMap[String(u._id)] = u.email; });

    let sent = 0;
    for (const officer of officers) {
      const email = emailMap[String(officer.userId)];
      if (!email) continue;
      await sendOfficerMessage({
        officerName: `${officer.firstName} ${officer.lastName}`,
        email,
        subject,
        body,
        senderName,
        companyName: req.user.companyName || 'Your Company',
      });
      sent++;
    }

    res.json({ success: true, sent });
  } catch (err) {
    console.error('sendMessage error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
