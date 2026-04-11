const User = require('../models/User');
const { MODULES } = require('../config/permissions');
const accessService = require('../services/accessService');

const SESSION_EXPIRED_MESSAGE = 'Your session expired because your account was logged in on another device.';

const isApiRequest = (req) =>
  req.xhr ||
  req.path.startsWith('/notifications') ||
  req.path.startsWith('/chat') ||
  (req.headers.accept && req.headers.accept.includes('application/json'));

const clearInvalidSession = (req, res, statusCode = 401) =>
  req.session.destroy(() => {
    res.clearCookie('connect.sid');

    if (isApiRequest(req)) {
      return res.status(statusCode).json({
        success: false,
        code: 'SESSION_EXPIRED',
        message: SESSION_EXPIRED_MESSAGE,
        redirectUrl: '/auth/login?reason=session_expired'
      });
    }

    return res.redirect('/auth/login?reason=session_expired');
  });

module.exports = {
  ensureAuthenticated: function (req, res, next) {
    if (req.session.user) {
      return next();
    }
    req.flash('error_msg', 'Please log in to view that resource');
    res.redirect('/auth/login');
  },
  forwardAuthenticated: function (req, res, next) {
    if (!req.session.user) {
      return next();
    }
    res.redirect('/dashboard');
  },
  /**
   * sessionGuard: Verifies that the current session token matches the one in DB.
   * If not, forces logout.
   */
  sessionGuard: async function (req, res, next) {
    if (req.session.user) {
      try {
        const user = await User.findById(req.session.user._id).select('current_session_token role');
        const sessionToken = req.session.session_token;

        if (!user || !sessionToken || user.current_session_token !== sessionToken) {
          return clearInvalidSession(req, res);
        }

        if (req.session.user.role !== user.role) {
          req.session.user.role = user.role;
        }
      } catch (err) {
        console.error('Session Guard Error:', err);
        return next(err);
      }
    }
    return next();
  },
  authorizeModule: function (moduleName) {
    return function (req, res, next) {
      const user = req.session.user;
      if (user && accessService.canAccessModule(user, moduleName)) {
        return next();
      }

      req.flash('error_msg', 'You do not have permission to access that module.');
      return res.redirect('/dashboard');
    };
  },
  authorizeRoles: function (...roles) {
    return function (req, res, next) {
      const user = accessService.getUserContext(req.session.user);
      if (user && roles.includes(user.role)) {
        return next();
      }

      req.flash('error_msg', 'You do not have the required role for this action.');
      return res.redirect('/dashboard');
    };
  }
};
