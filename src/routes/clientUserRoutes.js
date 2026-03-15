const express = require('express');
const router = express.Router();
const clientUserController = require('../controllers/clientUserController');
const { authenticate } = require('../middleware/auth');
const { protectClientUser } = require('../middleware/clientUserAuth');

// Public routes (no auth)
router.post('/login',           clientUserController.login);
router.post('/forgot-password', clientUserController.forgotPassword);
router.post('/reset-password',  clientUserController.resetPassword);

// Portal routes (client user JWT)
router.get('/me',               protectClientUser, clientUserController.getMe);
router.post('/change-password', protectClientUser, clientUserController.changePassword);

// Ops manager routes (existing JWT)
router.post('/create',  authenticate, clientUserController.createClientUser);
router.get('/',         authenticate, clientUserController.getClientUsers);
router.put('/:id',      authenticate, clientUserController.updateClientUser);
router.delete('/:id',   authenticate, clientUserController.deleteClientUser);

module.exports = router;
