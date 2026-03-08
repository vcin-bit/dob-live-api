const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getSites, createSite, updateSite, deactivateSite } = require('../controllers/siteController');

router.use(authenticate);

router.get('/', getSites);
router.post('/', requireRole('COMPANY', 'SUPER_ADMIN'), createSite);
router.put('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), updateSite);
router.delete('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), deactivateSite);

module.exports = router;
