const sanitizeHtml = require('sanitize-html');
const Note = require('../models/Note');
const Task = require('../models/Task');
const User = require('../models/User');
const taskService = require('../services/taskService');
const accessService = require('../services/accessService');

const TASK_STATUSES = ['Todo', 'In Progress', 'Done'];
const TASK_PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const sanitizeTaskInput = (body) => ({
  title: `${body.title || ''}`.trim(),
  description: sanitizeHtml(body.description || ''),
  deadline: body.deadline || null,
  priority: body.priority || 'Medium',
  status: body.status || 'Todo',
  assignedTo: body.assignedTo || null,
  tags: `${body.tags || ''}`
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
});

const getAssignableUsers = async () => User.find({}, 'name email role').sort({ name: 1 }).lean();

exports.listTasks = async (req, res) => {
  try {
    const filters = {
      search: req.query.search || '',
      status: req.query.status || '',
      priority: req.query.priority || '',
      assignedTo: req.query.assignedTo || ''
    };

    const tasks = await taskService
      .populateTaskQuery(Task.find(taskService.buildTaskFilters(req.session.user, filters)).sort({ deadline: 1, updatedAt: -1 }))
      .lean();

    const users = await getAssignableUsers();

    res.render('tasks/index', {
      page: 'tasks',
      tasks,
      users,
      filters,
      taskStatuses: TASK_STATUSES,
      taskPriorities: TASK_PRIORITIES
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};

exports.renderCreateTask = async (req, res) => {
  try {
    const users = await getAssignableUsers();
    let sourceNote = null;

    if (req.query.fromNote) {
      sourceNote = await Note.findById(req.query.fromNote).lean();
      if (!sourceNote) {
        req.flash('error_msg', 'The note you selected could not be found.');
        return res.redirect('/notes');
      }
    }

    res.render('tasks/add', {
      page: 'tasks',
      users,
      taskStatuses: TASK_STATUSES,
      taskPriorities: TASK_PRIORITIES,
      sourceNote,
      formData: {
        title: sourceNote ? sourceNote.title : '',
        description: sourceNote ? sourceNote.description : '',
        deadline: '',
        priority: sourceNote ? sourceNote.priority : 'Medium',
        status: 'Todo',
        assignedTo: '',
        tags: sourceNote && sourceNote.tags ? sourceNote.tags.join(', ') : ''
      }
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};

exports.createTask = async (req, res) => {
  try {
    const payload = sanitizeTaskInput(req.body);
    if (!payload.title) {
      req.flash('error_msg', 'Task title is required.');
      return res.redirect(req.body.sourceNote ? `/tasks/add?fromNote=${req.body.sourceNote}` : '/tasks/add');
    }

    await taskService.createTaskFromPayload({
      payload,
      reqUser: req.session.user,
      sourceNoteId: req.body.sourceNote || null
    });

    req.flash('success_msg', req.body.sourceNote ? 'Note converted into a task successfully.' : 'Task created successfully.');
    return res.redirect('/tasks');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Unable to create task.');
    return res.redirect('/tasks');
  }
};

exports.renderEditTask = async (req, res) => {
  try {
    const task = await taskService.getTaskByIdForUser(req.params.id, req.session.user);
    if (!task) {
      return res.render('error/404');
    }

    const users = await getAssignableUsers();
    return res.render('tasks/edit', {
      page: 'tasks',
      task,
      users,
      taskStatuses: TASK_STATUSES,
      taskPriorities: TASK_PRIORITIES
    });
  } catch (error) {
    console.error(error);
    return res.render('error/500');
  }
};

exports.updateTask = async (req, res) => {
  try {
    const existingTask = await Task.findById(req.params.id);
    if (!existingTask || !accessService.canManageTask(req.session.user, existingTask)) {
      return res.render('error/404');
    }

    const payload = sanitizeTaskInput(req.body);
    payload.activityCount = (existingTask.activityCount || 0) + 1;
    payload.completedAt = payload.status === 'Done' ? existingTask.completedAt || new Date() : null;

    await Task.findByIdAndUpdate(req.params.id, payload, { runValidators: true });

    req.flash('success_msg', 'Task updated successfully.');
    return res.redirect('/tasks');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Unable to update task.');
    return res.redirect('/tasks');
  }
};

exports.renderBoard = async (req, res) => {
  try {
    const tasks = await taskService
      .populateTaskQuery(Task.find(taskService.buildTaskFilters(req.session.user, {})).sort({ updatedAt: -1 }))
      .lean();

    const groupedTasks = TASK_STATUSES.reduce((acc, status) => {
      acc[status] = tasks.filter((task) => task.status === status);
      return acc;
    }, {});

    res.render('tasks/board', {
      page: 'kanban',
      groupedTasks,
      taskStatuses: TASK_STATUSES
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};

exports.updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!TASK_STATUSES.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid task status.' });
    }

    const task = await Task.findById(req.params.id);
    if (!task || !accessService.canManageTask(req.session.user, task)) {
      return res.status(404).json({ success: false, message: 'Task not found.' });
    }

    task.status = status;
    task.activityCount = (task.activityCount || 0) + 1;
    task.completedAt = status === 'Done' ? task.completedAt || new Date() : null;
    await task.save();

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: 'Failed to update task.' });
  }
};
