const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.TASKS));

router.get('/', taskController.listTasks);
router.get('/add', taskController.renderCreateTask);
router.post('/', taskController.createTask);
router.get('/board', authorizeModule(MODULES.KANBAN), taskController.renderBoard);
router.patch('/:id/status', authorizeModule(MODULES.KANBAN), taskController.updateTaskStatus);
router.get('/edit/:id', taskController.renderEditTask);
router.put('/:id', taskController.updateTask);

module.exports = router;
