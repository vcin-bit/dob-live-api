const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { createEntry, getEntries, getEntry } = require('../controllers/entryController');

router.use(authenticate);

router.post('/', createEntry);
router.get('/', getEntries);
router.get('/:id', getEntry);

module.exports = router;
