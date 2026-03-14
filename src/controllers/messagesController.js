const User    = require('../models/User');
const Officer = require('../models/Officer');
const Message = require('../models/Message');
const { sendOfficerMessage } = require('../utils/email');

exports.sendMessage = async (req, res) => {
  try {
    const { subject, body, recipientIds } = req.body;
    if (!subject || !body || !recipientIds?.length)
      return res.status(400).json({ error: 'subject, body and recipientIds required' });

    const company    = req.user.companyId;
    const senderName = req.user.name || 'Your Operations Manager';

    const officers = await Officer.find({
      _id: { $in: recipientIds },
      companyId: company,
    });

    if (!officers.length)
      return res.status(404).json({ error: 'No matching officers found' });

    const userIds  = officers.map(o => o.userId).filter(Boolean);
    const users    = await User.find({ _id: { $in: userIds } }).select('email name');
    const emailMap = {};
    users.forEach(u => { emailMap[String(u._id)] = u.email; });

    // Store in DB so officers can see it in-app
    await Message.create({
      companyId: company,
      senderName,
      subject,
      body,
      recipients: officers.map(o => ({
        officerId: o._id,
        name: `${o.firstName} ${o.lastName}`,
        ackedAt: null,
      })),
    });

    // Send emails
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

// GET /api/messages/inbox — unread messages for the logged-in officer
exports.getInbox = async (req, res) => {
  try {
    const officerId = req.user.officerId;
    if (!officerId) return res.json([]);

    const messages = await Message.find({
      'recipients.officerId': officerId,
    }).sort({ createdAt: -1 }).limit(20);

    const result = messages.map(m => {
      const rec = m.recipients.find(r => String(r.officerId) === String(officerId));
      return {
        _id:        m._id,
        subject:    m.subject,
        body:       m.body,
        senderName: m.senderName,
        sentAt:     m.createdAt,
        ackedAt:    rec ? rec.ackedAt : null,
      };
    });

    res.json(result);
  } catch (err) {
    console.error('getInbox error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// POST /api/messages/:id/ack
exports.ackMessage = async (req, res) => {
  try {
    const officerId = req.user.officerId;
    if (!officerId) return res.status(400).json({ error: 'No officerId on token' });

    await Message.updateOne(
      { _id: req.params.id, 'recipients.officerId': officerId },
      { $set: { 'recipients.$.ackedAt': new Date() } }
    );

    res.json({ success: true });
  } catch (err) {
    console.error('ackMessage error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};
