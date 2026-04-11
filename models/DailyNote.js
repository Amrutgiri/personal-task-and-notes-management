const mongoose = require('mongoose');

const DailyNoteSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: true,
    default: Date.now
  },
  project_name: {
    type: String,
    required: true
  },
  task_title: {
    type: String,
    required: true
  },
  day_start_description: {
    type: String,
    required: true
  },
  day_end_description: {
    type: String
  },
  status: {
    type: String,
    enum: ['Pending', 'Started', 'InProgress', 'Completed', 'Holiday'],
    default: 'Pending'
  },
  remarks: {
    type: String
  },
  is_synced: {
    type: Boolean,
    default: false
  },
  synced_at: {
    type: Date
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('DailyNote', DailyNoteSchema);