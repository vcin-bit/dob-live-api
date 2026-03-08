const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getCompanies,
  createCompany,
  updateCompany,
  suspendCompany,
  deleteCompany,
  resetManagerPassword,
  getStats
} = require('../controllers/adminController');

router.use(authenticate);
router.use(requireRole('SUPER_ADMIN'));

router.get('/companies', getCompanies);
router.post('/companies', createCompany);
router.put('/companies/:id', updateCompany);
router.post('/companies/:id/suspend', suspendCompany);
router.delete('/companies/:id', deleteCompany);
router.post('/companies/:id/reset-password', resetManagerPassword);
router.get('/stats', getStats);

module.exports = router;
