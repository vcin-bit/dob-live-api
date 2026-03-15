const jwt = require('jsonwebtoken');
const ClientUser = require('../models/ClientUser');

const protectClientUser = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ message: 'Not authorised — no token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== 'clientUser') {
      return res.status(401).json({ message: 'Not authorised — invalid token type' });
    }

    const user = await ClientUser.findById(decoded.id).select('-password -resetToken -resetTokenExpiry');
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Not authorised — user not found or inactive' });
    }

    req.clientUser = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorised — token invalid' });
  }
};

module.exports = { protectClientUser };
