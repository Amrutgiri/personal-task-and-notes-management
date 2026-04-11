const express = require('express');
const router = express.Router();
const { ensureAuthenticated, forwardAuthenticated } = require('../middleware/auth');
const Note = require('../models/Note');
const DailyNote = require('../models/DailyNote');
const Task = require('../models/Task');
const accessService = require('../services/accessService');

// Welcome Page
router.get('/', forwardAuthenticated, (req, res) => res.render('welcome'));

// Dashboard
router.get('/dashboard', ensureAuthenticated, async (req, res) => {
  try {
    const user = req.session.user;
    const noteScope = accessService.getVisibleUserFilter(user);
    const taskScope = accessService.getTaskAccessFilter(user);

    const totalNotes = await Note.countDocuments({ ...noteScope, status: 'active' });
    const archivedNotes = await Note.countDocuments({ ...noteScope, status: 'archived' });
    const trashNotes = await Note.countDocuments({ ...noteScope, status: 'trash' });
    const pendingDaily = await DailyNote.countDocuments({ ...noteScope, status: { $in: ['Pending', 'Started', 'InProgress'] } });
    const completedDaily = await DailyNote.countDocuments({ ...noteScope, status: 'Completed' });
    const totalTasks = await Task.countDocuments(taskScope);
    const doneTasks = await Task.countDocuments({ ...taskScope, status: 'Done' });
    const overdueTasks = await Task.countDocuments({
      ...taskScope,
      status: { $ne: 'Done' },
      deadline: { $lt: new Date() }
    });

    const recentWorkLogs = await DailyNote.find(noteScope)
      .sort({ date: -1, createdAt: -1 })
      .limit(5)
      .lean();

    const recentNotes = await Note.find({ ...noteScope, status: 'active' })
      .sort({ updatedAt: -1 })
      .limit(5)
      .lean();

    const recentTasks = await Task.find(taskScope)
      .populate('assignedTo', 'name')
      .sort({ updatedAt: -1 })
      .limit(6)
      .lean();

    const chartTasksByStatus = await Task.aggregate([
      { $match: taskScope },
      { $group: { _id: '$status', total: { $sum: 1 } } }
    ]);

    const productivityByPriority = await Task.aggregate([
      { $match: taskScope },
      { $group: { _id: '$priority', total: { $sum: 1 } } }
    ]);

    res.render('dashboard', {
      user: req.session.user,
      stats: {
        totalNotes,
        archivedNotes,
        trashNotes,
        pendingDaily,
        completedDaily,
        totalTasks,
        doneTasks,
        overdueTasks
      },
      recentNotes,
      recentWorkLogs,
      recentTasks,
      chartTasksByStatus,
      productivityByPriority,
      page: 'dashboard'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500'); // We should implement this view
  }
});

module.exports = router;
