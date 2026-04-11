const mongoose = require('mongoose');

const ChatSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['private', 'group', 'channel'],
    required: true
  },
  name: {
    type: String,
    trim: true
  },
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  admins: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  is_public: {
    type: Boolean,
    default: false
  },
  last_message: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Chat', ChatSchema);