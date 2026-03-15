const ClientUser = require('../models/ClientUser');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { send } = require('../utils/email');

const generateToken = (id) => {
  return jwt.sign({ id, type: 'clientUser' }, process.env.JWT_SECRET, { expiresIn: '7d' });
};

// POST /api/client-users/login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await ClientUser.findOne({ email })
      .populate('companyId', 'name')
      .populate('siteIds', 'name');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accessLevel: user.accessLevel,
        company: user.companyId,
        sites: user.siteIds
      }
    });
  } catch (err) {
    console.error('ClientUser login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await ClientUser.findOne({ email });

    if (!user) {
      return res.json({ message: 'If that email exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = new Date(Date.now() + 3600000);
    await user.save();

    const resetUrl = `https://portal.doblive.co.uk/reset-password.html?token=${token}`;

    await send(
      user.email,
      'DOB·LIVE Portal — Password Reset',
      `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#1b2b5e;font-family:Oswald,sans-serif;">Password Reset</h2>
        <p>You requested a password reset for your DOB·LIVE client portal account.</p>
        <p>Click the link below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#4d7cfe;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:16px 0;">Reset Password</a>
        <p style="color:#9aa3be;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>`
    );

    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    const user = await ClientUser.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: new Date() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/create (ops manager only)
exports.createClientUser = async (req, res) => {
  try {
    const { email, name, jobTitle, companyId, siteIds, accessLevel } = req.body;

    if (!email || !companyId) {
      return res.status(400).json({ message: 'Email and company are required' });
    }

    const existing = await ClientUser.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'A client user with this email already exists' });
    }

    const tempPassword = crypto.randomBytes(8).toString('hex');

    const user = await ClientUser.create({
      email,
      name,
      jobTitle,
      companyId,
      siteIds: siteIds || [],
      accessLevel: accessLevel || 'client',
      password: tempPassword
    });

    const loginUrl = 'https://portal.doblive.co.uk';
    await send(
      email,
      'Welcome to the DOB·LIVE Client Portal',
      `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px;">
        <h2 style="color:#1b2b5e;font-family:Oswald,sans-serif;">Welcome to DOB·LIVE</h2>
        <p>Hi ${name || 'there'},</p>
        <p>Your client portal account has been created. You can now view occurrence reports and site activity for your sites.</p>
        <div style="background:#f0f2f8;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px;"><strong>Login:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p style="margin:0 0 8px;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0;"><strong>Temporary Password:</strong> <code style="background:#e2e6f0;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
        </div>
        <a href="${loginUrl}" style="display:inline-block;background:#4d7cfe;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;margin:8px 0;">Access Portal</a>
        <p style="color:#9aa3be;font-size:13px;margin-top:16px;">Powered by DOB·LIVE by PSIN Group Ltd</p>
      </div>`
    );

    res.status(201).json({
      message: 'Client user created and welcome email sent',
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        accessLevel: user.accessLevel,
        companyId: user.companyId,
        siteIds: user.siteIds
      }
    });
  } catch (err) {
    console.error('Create client user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/client-users (ops manager — list all for company)
exports.getClientUsers = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const users = await ClientUser.find({ companyId })
      .populate('companyId', 'name')
      .populate('siteIds', 'name')
      .select('-password -resetToken -resetTokenExpiry')
      .sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    console.error('Get client users error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// PUT /api/client-users/:id
exports.updateClientUser = async (req, res) => {
  try {
    const { name, jobTitle, siteIds, accessLevel, isActive } = req.body;
    const user = await ClientUser.findOneAndUpdate(
      { _id: req.params.id, companyId: req.user.companyId },
      { name, jobTitle, siteIds, accessLevel, isActive },
      { new: true }
    ).populate('companyId', 'name').populate('siteIds', 'name').select('-password -resetToken -resetTokenExpiry');

    if (!user) return res.status(404).json({ message: 'Client user not found' });
    res.json(user);
  } catch (err) {
    console.error('Update client user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/client-users/:id
exports.deleteClientUser = async (req, res) => {
  try {
    await ClientUser.findOneAndDelete({ _id: req.params.id, companyId: req.user.companyId });
    res.json({ message: 'Client user deleted' });
  } catch (err) {
    console.error('Delete client user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/client-users/me
exports.getMe = async (req, res) => {
  try {
    const user = await ClientUser.findById(req.clientUser._id)
      .populate('companyId', 'name')
      .populate('siteIds', 'name')
      .select('-password -resetToken -resetTokenExpiry');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/change-password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await ClientUser.findById(req.clientUser._id);

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// GET /api/client-users/alerts — alerts for client user's assigned sites
exports.getAlerts = async (req, res) => {
  try {
    const ClientAlert = require('../models/ClientAlert');
    const user = await ClientUser.findById(req.clientUser._id).populate('siteIds', 'name');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const siteIds = user.siteIds.map(s => s._id || s);
    if (!siteIds.length) return res.json({ alerts: [] });

    const alerts = await ClientAlert.find({ site: { $in: siteIds } })
      .populate({ path: 'entry', populate: { path: 'officer', select: 'firstName lastName name' } })
      .populate('site', 'name')
      .sort({ createdAt: -1 })
      .limit(100);

    res.json({ alerts });
  } catch (err) {
    console.error('getAlerts error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/alerts/:id/acknowledge
exports.acknowledgeAlert = async (req, res) => {
  try {
    const ClientAlert = require('../models/ClientAlert');
    const { comment } = req.body;
    const name = req.clientUser.name || req.clientUser.email;

    const update = {
      status: 'acknowledged',
      acknowledgedAt: new Date(),
      acknowledgedBy: name,
      read: true,
      readAt: new Date()
    };
    if (comment?.trim()) {
      update.$push = { comments: { from: 'client', name, text: comment.trim() } };
    }

    const alert = await ClientAlert.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate({ path: 'entry', populate: { path: 'officer', select: 'firstName lastName name' } })
      .populate('site', 'name');

    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    console.error('acknowledgeAlert error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/client-users/alerts/:id/comment
exports.commentAlert = async (req, res) => {
  try {
    const ClientAlert = require('../models/ClientAlert');
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ message: 'Comment text required' });

    const name = req.clientUser.name || req.clientUser.email;
    const alert = await ClientAlert.findByIdAndUpdate(
      req.params.id,
      { $push: { comments: { from: 'client', name, text: text.trim() } } },
      { new: true }
    ).populate({ path: 'entry', populate: { path: 'officer', select: 'firstName lastName name' } })
     .populate('site', 'name');

    if (!alert) return res.status(404).json({ message: 'Alert not found' });
    res.json({ success: true, alert });
  } catch (err) {
    console.error('commentAlert error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
