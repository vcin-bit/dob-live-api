const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getOfficers, createOfficer, updateOfficer,
  suspendOfficer, resetOfficerPassword,
  deactivateOfficer, getOfficerStatus
} = require('../controllers/officerController');

router.use(authenticate);
router.get('/', getOfficers);
router.post('/', requireRole('COMPANY', 'SUPER_ADMIN'), createOfficer);
router.put('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), updateOfficer);
router.post('/:id/suspend', requireRole('COMPANY', 'SUPER_ADMIN'), suspendOfficer);
router.post('/:id/reset-password', requireRole('COMPANY', 'SUPER_ADMIN'), resetOfficerPassword);
router.delete('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), deactivateOfficer);
router.get('/:id/status', getOfficerStatus);

module.exports = router;
