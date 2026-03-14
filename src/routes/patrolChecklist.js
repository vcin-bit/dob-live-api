const express = require('express');
const router  = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getChecklist, saveChecklist, flagCheckpoint } = require('../controllers/patrolCecklistController');

router.get('/',      authenticate, getChecklist);
router.put('/',      authenticate, requireRole('COMPANY', 'SUPER_ADMIN'), saveChecklist);
router.post('/flag', authenticate, flagCheckpoint);

module.exports = router;
