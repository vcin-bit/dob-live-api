const express = require('express');
const router = express.Router();
const {
  login,
  forgotPassword,
  resetPassword,
  createClientUser,
  getClientUsers,
  updateClientUser,
  deleteClientUser,
  getMe,
  changePassword
} = require('../controllers/clientUserController');

const { authenticate } = require('../middleware/auth');           // existing ops manager auth
const { protectClientUser } = require('../middleware/clientUserAuth'); // new middleware

// Public routes (no auth)
router.post('/login', login);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// Portal routes (client user JWT)
router.get('/me', protectClientUser, getMe);
router.post('/change-password', protectClientUser, changePassword);

// Ops manager routes (existing JWT)
router.post('/create', authenticate, createClientUser);
router.get('/', authenticate, getClientUsers);
router.put('/:id', authenticate, updateClientUser);
router.delete('/:id', authenticate, deleteClientUser);

module.exports = router;
