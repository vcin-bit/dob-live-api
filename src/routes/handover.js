const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { createBrief, getLatest, acknowledge, listBriefs } = require('../controllers/handoverController');

router.post('/',                authenticate, requireRole('OFFICER'), createBrief);
router.get('/latest',           authenticate, requireRole('OFFICER'), getLatest);
router.post('/:id/acknowledge', authenticate, requireRole('OFFICER'), acknowledge);
router.get('/',                 authenticate, requireRole('COMPANY'), listBriefs);

module.exports = router;
