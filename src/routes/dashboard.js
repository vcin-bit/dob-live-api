const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getDashboard, getFeed } = require('../controllers/dashboardController');

router.use(authenticate);
router.use(requireRole('COMPANY', 'SUPER_ADMIN'));

router.get('/', getDashboard);
router.get('/feed', getFeed);

module.exports = router;
