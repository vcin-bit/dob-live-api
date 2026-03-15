const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createTask, getTasks, getOfficerTasks,
  acknowledgeTask, completeTask
} = require('../controllers/clientTaskController');

router.post('/',                authenticate, createTask);
router.get('/',                 authenticate, requireRole('COMPANY'), getTasks);
router.get('/officer',          authenticate, requireRole('OFFICER'), getOfficerTasks);
router.post('/:id/acknowledge', authenticate, requireRole('OFFICER'), acknowledgeTask);
router.post('/:id/complete',    authenticate, requireRole('OFFICER'), completeTask);

module.exports = router;
