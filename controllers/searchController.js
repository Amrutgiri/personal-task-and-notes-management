const mongoose = require('mongoose');
const Note = require('../models/Note');
const Task = require('../models/Task');
const Chat = require('../models/Chat');
const Message = require('../models/Message');
const accessService = require('../services/accessService');

exports.globalSearch = async (req, res) => {
  try {
    const q = `${req.query.q || ''}`.trim();
    if (!q) {
      return res.render('search/index', {
        page: 'search',
        query: '',
        results: { notes: [], tasks: [], chats: [] }
      });
    }

    const noteScope = accessService.getVisibleUserFilter(req.session.user);
    const taskScope = accessService.getTaskAccessFilter(req.session.user);
    const userId = new mongoose.Types.ObjectId(req.session.user._id);

    const [notes, tasks, messages] = await Promise.all([
      Note.find({
        ...noteScope,
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ]
      })
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      Task.find({
        ...taskScope,
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } }
        ]
      })
        .populate('assignedTo', 'name')
        .sort({ updatedAt: -1 })
        .limit(8)
        .lean(),
      Message.find({
        content: { $regex: q, $options: 'i' }
      })
        .populate({
          path: 'chat',
          match: {
            $or: [
              { participants: userId },
              { type: 'channel', is_public: true }
            ]
          }
        })
        .populate('sender', 'name')
        .sort({ createdAt: -1 })
        .limit(10)
        .lean()
    ]);

    const chats = messages.filter((message) => message.chat);
    const uniqueChatResults = Array.from(
      new Map(chats.map((message) => [String(message._id), message])).values()
    );

    res.render('search/index', {
      page: 'search',
      query: q,
      results: {
        notes,
        tasks,
        chats: uniqueChatResults
      }
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};
