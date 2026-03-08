const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');

const {
  createEntry,
  getEntries,
  getEntry,
  getAlerts,
  markAlertRead,
} = require('../controllers/entryController');

// All entry routes require authentication
router.use(protect);

// ── IMPORTANT: named routes MUST come before /:id ──────────────────────────
router.get('/',                   getEntries);       // 1. list all entries
router.get('/alerts',             getAlerts);        // 2. named — BEFORE /:id
router.patch('/alerts/:id/read',  markAlertRead);    // 3. named — BEFORE /:id
router.post('/',                  createEntry);      // 4. create entry
router.get('/:id',                getEntry);         // 5. param — always last

module.exports = router;
