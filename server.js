const express = require('express');
const router  = express.Router();
const { authenticate } = require('../middleware/auth');

const {
  createEntry,
  getEntries,
  getEntry,
  getAlerts,
  markAlertRead,
  resolveEntry,
  getArchive,
} = require('../controllers/entryController');

router.use(authenticate);

router.get('/',                  getEntries);
router.get('/archive',           getArchive);
router.get('/alerts',            getAlerts);
router.patch('/alerts/:id/read', markAlertRead);
router.post('/',                 createEntry);
router.get('/:id',               getEntry);
router.post('/:id/resolve',      resolveEntry);

module.exports = router;
