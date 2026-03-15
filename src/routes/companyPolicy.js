const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const { get, save } = require('../controllers/companyPolicyController');

router.get('/',  authenticate, get);
router.put('/',  authenticate, requireRole('COMPANY'), save);

module.exports = router;
