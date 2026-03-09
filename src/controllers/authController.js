const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const User   = require('../models/User');
const { sendPasswordReset } = require('../utils/email');
const generateAccessToken  = (userId) => jwt.sign({ userId }, process.env.JWT_SECRET,         { expiresIn: '8h' });
const generateRefreshToken = (userId) => jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, { expiresIn: '30d' });
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
    await User.findByIdAndUpdate(user._id, { lastLogin: new Date() });
    const accessToken  = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);
    res.cookie('dob_refresh', refreshToken, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge:   30 * 24 * 60 * 60 * 1000
    });
    res.json({
      token: accessToken,
      user: { id: user._id, email: user.email, name: user.name, role: user.role, companyId: user.companyId }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.logout = (req, res) => {
  res.clearCookie('dob_refresh');
  res.json({ message: 'Logged out' });
};
exports.refresh = async (req, res) => {
  try {
    const token = req.cookies.dob_refresh;
    if (!token) return res.status(401).json({ error: 'No refresh token' });
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user    = await User.findById(decoded.userId).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'User not found' });
    res.json({ token: generateAccessToken(user._id) });
  } catch (error) {
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};
exports.me = async (req, res) => {
  res.json({
    id: req.user._id, email: req.user.email, name: req.user.name,
    role: req.user.role, companyId: req.user.companyId
  });
};
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.json({ message: 'If that email exists, a reset link has been sent.' });
    const token  = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000);
    await User.findByIdAndUpdate(user._id, { resetToken: token, resetTokenExpiry: expiry });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password.html?token=${token}`;
    await sendPasswordReset({ name: user.name, email: user.email, resetUrl });
    res.json({ message: 'If that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) return res.status(400).json({ error: 'Token and password required' });
    const user = await User.findOne({ resetToken: token, resetTokenExpiry: { $gt: new Date() } });
    if (!user) return res.status(400).json({ error: 'Invalid or expired reset token' });
    await User.findByIdAndUpdate(user._id, {
      passwordHash:      await bcrypt.hash(password, 12),
      resetToken:        null,
      resetTokenExpiry:  null
    });
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ error: 'Current and new password required' });
    if (newPassword.length < 8)
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    await User.findByIdAndUpdate(user._id, {
      passwordHash: await bcrypt.hash(newPassword, 12)
    });
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
};
