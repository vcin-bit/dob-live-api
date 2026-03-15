const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { subscribe, getVapidKey }    = require('../controllers/pushController');

router.get('/vapidPublicKey',  getVapidKey);
router.post('/subscribe',      authenticate, requireRole('COMPANY'), subscribe);

module.exports = router;
