const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { acknowledge, getStatus, getRecords } = require('../controllers/instructionsAckController');

router.post('/',       authenticate, requireRole('OFFICER'), acknowledge);
router.get('/status',  authenticate, requireRole('OFFICER'), getStatus);
router.get('/records', authenticate, requireRole('COMPANY'), getRecords);

module.exports = router;
