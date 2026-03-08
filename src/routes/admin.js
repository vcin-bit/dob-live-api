const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getCompanies, createCompany, getStats } = require('../controllers/adminController');

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.get('/stats', getStats);

module.exports = router;
