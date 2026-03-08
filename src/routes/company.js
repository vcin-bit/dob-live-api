const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getProfile, updateProfile } = require('../controllers/companyController');

router.use(authenticate);
router.use(requireRole('COMPANY'));
router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
