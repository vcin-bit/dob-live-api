const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  login, logout, refresh, me,
  forgotPassword, resetPassword
} = require('../controllers/authController');

router.post('/login', login);
router.post('/logout', logout);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.get('/me', authenticate, me);

module.exports = router;
