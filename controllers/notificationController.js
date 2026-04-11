const Subscription = require('../models/Subscription');

// @desc    Subscribe to push notifications
// @route   POST /notifications/subscribe
exports.subscribe = async (req, res) => {
  try {
    const subscription = req.body;
    const userId = req.session.user._id;
    const sessionToken = req.session.session_token;

    // Check if subscription already exists
    const existing = await Subscription.findOne({ endpoint: subscription.endpoint });
    
    if (existing) {
      existing.user = userId;
      existing.sessionToken = sessionToken;
      existing.expirationTime = subscription.expirationTime;
      existing.keys = subscription.keys;
      await existing.save();
    } else {
      await Subscription.create({
        user: userId,
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        sessionToken,
        keys: subscription.keys
      });
    }

    res.status(201).json({ success: true, message: 'Subscribed successfully' });
  } catch (err) {
    console.error('Subscription error:', err);
    res.status(500).json({ success: false, message: 'Failed to subscribe' });
  }
};

// @desc    Unsubscribe from push notifications
// @route   POST /notifications/unsubscribe
exports.unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await Subscription.deleteOne({ endpoint, user: req.session.user._id });
    res.json({ success: true, message: 'Unsubscribed successfully' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to unsubscribe' });
  }
};
