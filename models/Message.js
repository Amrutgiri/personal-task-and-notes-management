const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
  chat: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['text', 'image', 'video', 'file', 'code'],
    default: 'text'
  },
  content: {
    type: String,
    trim: true
  },
  language: {
    type: String, // For code messages
    default: 'javascript'
  },
  file_url: {
    type: String
  },
  file_name: {
    type: String
  },
  file_size: {
    type: String
  },
  status: {
    type: String,
    enum: ['sent', 'delivered', 'seen'],
    default: 'sent'
  },
  seen_by: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }]
}, {
  timestamps: true
});

module.exports = mongoose.model('Message', MessageSchema);