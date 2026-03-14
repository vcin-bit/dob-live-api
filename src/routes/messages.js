const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { sendMessage, getInbox, ackMessage } = require('../controllers/messagesController');

router.post('/send',      authenticate, requireRole('COMPANY'), sendMessage);
router.get('/inbox',      authenticate, requireRole('OFFICER'),  getInbox);
router.post('/:id/ack',   authenticate, requireRole('OFFICER'),  ackMessage);

module.exports = router;
