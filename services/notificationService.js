const webpush = require('web-push');
const Subscription = require('../models/Subscription');

// Set VAPID keys
webpush.setVapidDetails(
  'mailto:support@zennotes.com',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send push notification to a specific user
 * @param {string} userId - ID of the user to notify
 * @param {object} payload - Notification payload (title, body, icon, data)
 * @param {object} options - Optional delivery filters
 */
exports.sendPushNotification = async (userId, payload, options = {}) => {
  try {
    const query = { user: userId };
    if (options.sessionToken) {
      query.sessionToken = options.sessionToken;
    }

    const subscriptions = await Subscription.find(query);
    
    const notificationPayload = JSON.stringify(payload);

    const sendPromises = subscriptions.map(sub => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        expirationTime: sub.expirationTime,
        keys: sub.keys
      };

      return webpush.sendNotification(pushSubscription, notificationPayload)
        .catch(async (err) => {
          if (err.statusCode === 404 || err.statusCode === 410) {
            // Subscription has expired or is no longer valid
            console.log('Removing invalid subscription:', sub.endpoint);
            await Subscription.deleteOne({ _id: sub._id });
          } else {
            console.error('Push error:', err);
          }
        });
    });

    await Promise.all(sendPromises);
  } catch (err) {
    console.error('Error in sendPushNotification service:', err);
  }
};
