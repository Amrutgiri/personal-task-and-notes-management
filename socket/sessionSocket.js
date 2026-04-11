const User = require('../models/User');

const getUserRoom = (userId) => `user:${userId}`;
const getSessionRoom = (userId, sessionToken) => `user:${userId}:session:${sessionToken}`;

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const session = socket.request.session;

      if (!session || !session.user || !session.session_token) {
        return next();
      }

      const user = await User.findById(session.user._id).select('current_session_token');
      if (!user || user.current_session_token !== session.session_token) {
        return next(new Error('SESSION_EXPIRED'));
      }

      return next();
    } catch (error) {
      return next(error);
    }
  });

  io.on('connection', (socket) => {
    const session = socket.request.session;

    if (!session || !session.user || !session.session_token) {
      return;
    }

    const userId = session.user._id.toString();
    const sessionToken = session.session_token;

    socket.join(getUserRoom(userId));
    socket.join(getSessionRoom(userId, sessionToken));
  });
};
