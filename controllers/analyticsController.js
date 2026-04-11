const Task = require('../models/Task');
const Message = require('../models/Message');
const User = require('../models/User');
const accessService = require('../services/accessService');

exports.getAnalyticsDashboard = async (req, res) => {
  try {
    const taskScope = accessService.getTaskAccessFilter(req.session.user);
    const userScope = accessService.getUserContext(req.session.user).role === 'employee'
      ? { _id: req.session.user._id }
      : {};

    const completedTasks = await Task.aggregate([
      { $match: { ...taskScope, status: 'Done' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$updatedAt' } },
          total: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } },
      { $limit: 7 }
    ]);

    const productivity = await Task.aggregate([
      { $match: taskScope },
      {
        $group: {
          _id: '$priority',
          total: { $sum: 1 }
        }
      }
    ]);

    const userActivity = await Task.aggregate([
      { $match: taskScope },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Done'] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $project: {
          name: { $ifNull: [{ $arrayElemAt: ['$user.name', 0] }, 'Unassigned'] },
          total: 1,
          completed: 1
        }
      },
      { $sort: { total: -1 } },
      { $limit: 6 }
    ]);

    const summary = {
      totalUsers: await User.countDocuments(userScope),
      totalTasks: await Task.countDocuments(taskScope),
      completedTasks: await Task.countDocuments({ ...taskScope, status: 'Done' }),
      chatMessages: await Message.countDocuments()
    };

    res.render('analytics/index', {
      page: 'analytics',
      summary,
      completedTasks,
      productivity,
      userActivity
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};
