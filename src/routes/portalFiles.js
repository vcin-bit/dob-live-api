const express = require('express');
const router  = express.Router();
const { protectClientUser } = require('../middleware/clientUserAuth');
const ctrl = require('../controllers/portalFilesController');

router.get('/folders',              protectClientUser, ctrl.getFolders);
router.post('/folders',             protectClientUser, ctrl.createFolder);
router.delete('/folders/:id',       protectClientUser, ctrl.deleteFolder);
router.get('/documents',            protectClientUser, ctrl.getDocuments);
router.post('/documents/upload',    protectClientUser, ctrl.uploadDocument);
router.delete('/documents/:id',     protectClientUser, ctrl.deleteDocument);

module.exports = router;
