const mongoose = require('mongoose');
const { normalizeRole } = require('../config/permissions');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  googleSpreadsheetId: {
    type: String,
    default: ''
  },
  googleSheetName: {
    type: String,
    default: 'Sheet1'
  },
  profileImage: {
    type: String,
    default: '/img/default-avatar.png'
  },
  bio: {
    type: String,
    trim: true,
    default: ''
  },
  phoneNumber: {
    type: String,
    trim: true,
    default: ''
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'employee'],
    default: 'employee',
    set: normalizeRole
  },
  current_session_token: {
    type: String,
    default: null
  },
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});

UserSchema.pre('save', function normalizeUserRole() {
  this.role = normalizeRole(this.role);
});

UserSchema.pre('validate', function normalizeUserRoleBeforeValidate() {
  this.role = normalizeRole(this.role);
});

module.exports = mongoose.model('User', UserSchema);
