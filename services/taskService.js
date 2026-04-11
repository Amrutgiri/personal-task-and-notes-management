const Task = require('../models/Task');
const Note = require('../models/Note');
const accessService = require('./accessService');

const populateTaskQuery = (query) =>
  query
    .populate('assignedTo', 'name email role profileImage')
    .populate('createdBy', 'name email role')
    .populate('sourceNote', 'title');

const buildTaskFilters = (reqUser, filters = {}) => {
  const query = {
    ...accessService.getTaskAccessFilter(reqUser)
  };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.priority) {
    query.priority = filters.priority;
  }

  if (filters.assignedTo) {
    query.assignedTo = filters.assignedTo;
  }

  if (filters.search) {
    query.$and = query.$and || [];
    query.$and.push({
      $or: [
        { title: { $regex: filters.search, $options: 'i' } },
        { description: { $regex: filters.search, $options: 'i' } }
      ]
    });
  }

  return query;
};

const getTaskByIdForUser = async (taskId, reqUser) => {
  const task = await populateTaskQuery(Task.findById(taskId)).lean();

  if (!task || !accessService.canManageTask(reqUser, task)) {
    return null;
  }

  return task;
};

const createTaskFromPayload = async ({ payload, reqUser, sourceNoteId }) => {
  const task = await Task.create({
    ...payload,
    createdBy: reqUser._id,
    sourceNote: sourceNoteId || null,
    activityCount: 1,
    completedAt: payload.status === 'Done' ? new Date() : null
  });

  if (sourceNoteId) {
    await Note.findByIdAndUpdate(sourceNoteId, {
      $set: {
        convertedTask: task._id,
        taskConvertedAt: new Date()
      }
    });
  }

  return task;
};

module.exports = {
  populateTaskQuery,
  buildTaskFilters,
  getTaskByIdForUser,
  createTaskFromPayload
};
