const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  endpoint: {
    type: String,
    required: true,
    unique: true
  },
  expirationTime: {
    type: Number,
    default: null
  },
  sessionToken: {
    type: String,
    default: null,
    index: true
  },
  keys: {
    p256dh: {
      type: String,
      required: true
    },
    auth: {
      type: String,
      required: true
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Subscription', SubscriptionSchema);
