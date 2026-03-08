const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  getOfficers, createOfficer, updateOfficer,
  deactivateOfficer, getOfficerStatus
} = require('../controllers/officerController');

router.use(authenticate);

router.get('/', getOfficers);
router.post('/', requireRole('COMPANY', 'SUPER_ADMIN'), createOfficer);
router.put('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), updateOfficer);
router.delete('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), deactivateOfficer);
router.get('/:id/status', getOfficerStatus);

module.exports = router;
