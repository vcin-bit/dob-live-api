const express = require('express');
const router = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { getSites, createSite, updateSite, deactivateSite } = require('../controllers/siteController');
const Site = require('../models/Site');

router.use(authenticate);
router.get('/',    getSites);
router.post('/',   requireRole('COMPANY', 'SUPER_ADMIN'), createSite);
router.put('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), updateSite);
router.delete('/:id', requireRole('COMPANY', 'SUPER_ADMIN'), deactivateSite);

/* ── Client portal access — set PIN and enable/disable ── */
router.put('/:id/client-access', requireRole('COMPANY', 'SUPER_ADMIN'), async (req, res) => {
  try {
    const { clientPortalEnabled, clientPin } = req.body;
    const update = {};
    if (clientPortalEnabled !== undefined) update.clientPortalEnabled = clientPortalEnabled;
    if (clientPin !== undefined) {
      if (clientPin && !/^\d{4}$/.test(clientPin)) {
        return res.status(400).json({ error: 'PIN must be exactly 4 digits' });
      }
      update.clientPin = clientPin;
    }
    const site = await Site.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!site) return res.status(404).json({ error: 'Site not found' });
    res.json({ success: true, site });
  } catch (err) {
    console.error('Client access update error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
