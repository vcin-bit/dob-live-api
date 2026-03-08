const express = require('express');
const router  = express.Router();
const auth    = require('../middleware/auth');
const {
  createEntry,
  getEntries,
  getEntry,
  getAlerts,
  markAlertRead,
} = require('../controllers/entryController');

// All entry routes require authentication
router.use(auth);

// ── Entries ──────────────────────────────────────────────────
router.get('/',     getEntries);   // GET  /api/entries[?date=&siteId=]
router.post('/',    createEntry);  // POST /api/entries
router.get('/:id',  getEntry);     // GET  /api/entries/:id

// ── Client Alerts feed ───────────────────────────────────────
// GET  /api/entries/alerts[?siteId=&unread=true&since=]
// PATCH /api/entries/alerts/:id/read
router.get('/alerts',          getAlerts);
router.patch('/alerts/:id/read', markAlertRead);

module.exports = router;
