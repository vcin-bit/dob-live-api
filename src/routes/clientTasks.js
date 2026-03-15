const express  = require('express');
const router   = express.Router();
const { authenticate, requireRole } = require('../middleware/auth');
const {
  createTask, getTasks, getOfficerTasks,
  acknowledgeTask, completeTask, addComment
} = require('../controllers/clientTaskController');

router.post('/',                authenticate, createTask);
router.get('/',                 authenticate, requireRole('COMPANY'), getTasks);
router.get('/officer',          authenticate, getOfficerTasks);
router.post('/:id/acknowledge', authenticate, acknowledgeTask);
router.post('/:id/complete',    authenticate, completeTask);
router.post('/:id/comment',     authenticate, addComment);

module.exports = router;
