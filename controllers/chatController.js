const Chat = require('../models/Chat');
const Message = require('../models/Message');
const User = require('../models/User');

// @desc    Get all chats for user
// @route   GET /chat
exports.getChats = async (req, res) => {
  try {
    const userId = req.session.user._id;
    
    // Find chats where user is participant or it's a public channel
    const chats = await Chat.find({
      $or: [
        { participants: userId },
        { type: 'channel', is_public: true }
      ]
    })
    .populate('participants', 'name email profileImage')
    .populate('last_message')
    .sort({ updatedAt: -1 });

    const allUsers = await User.find({ _id: { $ne: userId } }, 'name email');

    res.render('chat/index', {
      user: req.session.user,
      chats,
      allUsers,
      page: 'chat'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Get messages for a chat
// @route   GET /chat/:id/messages
exports.getMessages = async (req, res) => {
  try {
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ message: 'Chat not found' });

    // Check if user has access
    if (chat.type !== 'channel' || !chat.is_public) {
      if (!chat.participants.includes(req.session.user._id)) {
        return res.status(403).json({ message: 'Access denied' });
      }
    }

    const messages = await Message.find({ chat: req.params.id })
      .populate('sender', 'name profileImage')
      .sort({ createdAt: 1 });

    res.json(messages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create/Get Private Chat
// @route   POST /chat/private
exports.createPrivateChat = async (req, res) => {
  try {
    const { recipientId } = req.body;
    const userId = req.session.user._id;

    if (!recipientId) return res.status(400).json({ message: 'Recipient is required' });
    if (recipientId.toString() === userId.toString()) {
      return res.status(400).json({ message: 'You cannot start a chat with yourself' });
    }

    const recipient = await User.findById(recipientId, 'name email profileImage');
    if (!recipient) return res.status(404).json({ message: 'User not found' });

    // Check if chat already exists
    let chat = await Chat.findOne({
      type: 'private',
      participants: { $all: [userId, recipientId], $size: 2 }
    });

    if (!chat) {
      chat = await Chat.create({
        type: 'private',
        participants: [userId, recipientId],
        created_by: userId
      });
    }

    const payload = chat.toObject();
    payload.participants = [
      { _id: userId, name: req.session.user.name, email: req.session.user.email, profileImage: req.session.user.profileImage },
      { _id: recipient._id, name: recipient.name, email: recipient.email, profileImage: recipient.profileImage }
    ];
    payload.display_name = recipient.name;
    payload.display_email = recipient.email;

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create Group Chat
// @route   POST /chat/group
exports.createGroup = async (req, res) => {
  try {
    const { name, participants } = req.body;
    const userId = req.session.user._id;

    if (!name || !name.trim()) return res.status(400).json({ message: 'Group name is required' });

    const members = Array.isArray(participants) ? participants : (participants ? [participants] : []);
    const uniqueMembers = [...new Set([...members.map(String), String(userId)])];

    let chat = await Chat.create({
      type: 'group',
      name: name.trim(),
      participants: uniqueMembers,
      admins: [userId],
      created_by: userId
    });

    chat = await chat.populate('participants', 'name email profileImage');
    const payload = chat.toObject();
    payload.display_name = chat.name;

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Create Channel
// @route   POST /chat/channel
exports.createChannel = async (req, res) => {
  try {
    const { name, is_public } = req.body;
    const userId = req.session.user._id;

    if (!name || !name.trim()) return res.status(400).json({ message: 'Channel name is required' });

    let chat = await Chat.create({
      type: 'channel',
      name: name.trim(),
      participants: [userId],
      admins: [userId],
      created_by: userId,
      is_public: is_public === 'true' || is_public === true
    });

    chat = await chat.populate('participants', 'name email profileImage');
    const payload = chat.toObject();
    payload.display_name = chat.name;

    res.json(payload);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Upload file for chat
// @route   POST /chat/upload
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Files are stored on Cloudinary (see middleware/upload.js); `path` holds the
    // CDN URL while `filename` is just the public_id — never build an /uploads/ URL here.
    const fileUrl = req.file.path || `/uploads/${req.file.filename}`;
    const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'file';

    res.json({ fileUrl, fileType });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Add member to group/channel
// @route   POST /chat/:id/members
exports.addMember = async (req, res) => {
  try {
    const { userId } = req.body;
    const chat = await Chat.findById(req.params.id);

    if (!chat.admins.includes(req.session.user._id)) {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    if (!chat.participants.includes(userId)) {
      chat.participants.push(userId);
      await chat.save();
    }

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Remove member from group/channel
// @route   DELETE /chat/:id/members/:userId
exports.removeMember = async (req, res) => {
  try {
    const { userId } = req.params;
    const chat = await Chat.findById(req.params.id);

    if (!chat.admins.includes(req.session.user._id)) {
      return res.status(403).json({ message: 'Only admins can remove members' });
    }

    chat.participants = chat.participants.filter(p => p.toString() !== userId);
    chat.admins = chat.admins.filter(a => a.toString() !== userId);
    await chat.save();

    res.json(chat);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// @desc    Leave chat
// @route   POST /chat/:id/leave
exports.leaveChat = async (req, res) => {
  try {
    const userId = req.session.user._id;
    const chat = await Chat.findById(req.params.id);

    chat.participants = chat.participants.filter(p => p.toString() !== userId.toString());
    chat.admins = chat.admins.filter(a => a.toString() !== userId.toString());
    
    // If no participants left, delete chat or handle as needed
    if (chat.participants.length === 0 && chat.type !== 'channel') {
        // keep it or delete? usually keep for history if needed, but here let's just save
    }

    await chat.save();
    res.json({ message: 'Left successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};