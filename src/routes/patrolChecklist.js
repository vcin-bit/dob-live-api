const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');
const { getChecklist, saveChecklist, flagCheckpoint } = require('../controllers/patrolChecklistController');

router.get('/',      authenticate, getChecklist);

router.put('/',      authenticate, (req, res, next) => {
  if (req.user.role !== 'COMPANY' && req.user.role !== 'SUPER_ADMIN') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
}, saveChecklist);

router.post('/flag', authenticate, flagCheckpoint);

module.exports = router;
