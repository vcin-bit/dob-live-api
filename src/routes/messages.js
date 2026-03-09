const express    = require('express');
const router     = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { sendMessage } = require('../controllers/messagesController');

router.post('/send', authenticate, requireRole('COMPANY'), sendMessage);

module.exports = router;
