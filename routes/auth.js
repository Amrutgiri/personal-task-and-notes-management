const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { randomUUID, randomBytes, createHash } = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { normalizeRole } = require('../config/permissions');
const emailService = require('../services/emailService');

const RESET_TOKEN_TTL_MINUTES = 30;
const STRONG_PASSWORD = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

const hashToken = (token) => createHash('sha256').update(token).digest('hex');

const hashPassword = async (plainPassword) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

const buildResetUrl = (req, token) =>
  `${req.protocol}://${req.get('host')}/auth/reset-password/${token}`;

const buildSessionUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  googleSpreadsheetId: user.googleSpreadsheetId,
  googleSheetName: user.googleSheetName,
  profileImage: user.profileImage,
  bio: user.bio,
  phoneNumber: user.phoneNumber,
  role: normalizeRole(user.role)
});

const destroySession = (req) =>
  new Promise((resolve, reject) => {
    req.session.destroy((err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });

const regenerateSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((err) => {
      if (err) {
        return reject(err);
      }

      return resolve();
    });
  });

// Login Page
router.get('/login', (req, res) => res.render('auth/login'));

// Register Page
router.get('/register', (req, res) => res.render('auth/register'));

// Register Handle
router.post('/register', (req, res) => {
  const { name, email, password, confirm_password } = req.body;
  let errors = [];

  if (!name || !email || !password || !confirm_password) {
    errors.push({ msg: 'Please enter all fields' });
  }

  if (password !== confirm_password) {
    errors.push({ msg: 'Passwords do not match' });
  }

  if (password.length < 6) {
    errors.push({ msg: 'Password must be at least 6 characters' });
  }

  if (errors.length > 0) {
    res.render('auth/register', {
      errors,
      name,
      email,
      password,
      confirm_password
    });
  } else {
    User.findOne({ email: email }).then(user => {
      if (user) {
        errors.push({ msg: 'Email already exists' });
        res.render('auth/register', {
          errors,
          name,
          email,
          password,
          confirm_password
        });
      } else {
        User.countDocuments({}).then((userCount) => {
        const newUser = new User({
          name,
          email,
          password,
          role: userCount === 0 ? 'admin' : 'employee'
        });

        bcrypt.genSalt(10, (err, salt) => {
          bcrypt.hash(newUser.password, salt, (err, hash) => {
            if (err) throw err;
            newUser.password = hash;
            newUser.save()
              .then(user => {
                req.flash(
                  'success_msg',
                  'You are now registered and can log in'
                );
                res.redirect('/auth/login');
              })
              .catch(err => console.log(err));
          });
        });
        });
      }
    });
  }
});

// Login Handle
router.post('/login', async (req, res, next) => {
  const { email, password } = req.body;

  // Simple validation
  if (!email || !password) {
    req.flash('error_msg', 'Please enter all fields');
    if (email) {
      req.flash('old_email', email);
    }
    return res.redirect('/auth/login');
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('error_msg', 'Email is not registered');
      req.flash('old_email', email);
      return res.redirect('/auth/login');
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash('error_msg', 'Password incorrect');
      req.flash('old_email', email);
      return res.redirect('/auth/login');
    }

    const previousSessionToken = user.current_session_token;
    const nextSessionToken = randomUUID();

    await User.updateOne(
      { _id: user._id },
      { $set: { current_session_token: nextSessionToken } }
    );

    await regenerateSession(req);
    req.session.user = buildSessionUser(user);
    req.session.session_token = nextSessionToken;
    await saveSession(req);

    if (previousSessionToken && previousSessionToken !== nextSessionToken) {
      const io = req.app.get('io');

      io.to(`user:${user._id}:session:${previousSessionToken}`).emit('force_logout', {
        reason: 'SESSION_REPLACED',
        message: 'Session expired due to login from another device.',
        redirectUrl: '/auth/login?reason=session_expired'
      });

      req.app.get('notificationService').sendPushNotification(
        user._id,
        {
          title: 'Session expired',
          body: 'Session expired due to login from another device.',
          icon: '/img/logo.png',
          url: '/auth/login?reason=session_expired'
        },
        { sessionToken: previousSessionToken }
      );
    }

    req.flash('success_msg', 'You are now logged in');
    return res.redirect('/dashboard');
  } catch (err) {
    return next(err);
  }
});

// Forgot Password Page
router.get('/forgot-password', (req, res) => res.render('auth/forgot-password'));

// Forgot Password Handle
router.post('/forgot-password', async (req, res, next) => {
  const { email } = req.body;
  const genericMessage = 'If an account exists for that email, a password reset link has been sent.';

  if (!email) {
    req.flash('error_msg', 'Please enter your email address');
    return res.redirect('/auth/forgot-password');
  }

  try {
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('success_msg', genericMessage);
      return res.redirect('/auth/forgot-password?sent=1');
    }

    const rawToken = randomBytes(32).toString('hex');
    user.resetPasswordToken = hashToken(rawToken);
    user.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    await user.save();

    const resetUrl = buildResetUrl(req, rawToken);

    // Dev fallback: no SMTP configured -> show the link on screen instead of emailing
    if (!emailService.isEmailConfigured()) {
      return res.render('auth/forgot-password', {
        devResetUrl: resetUrl,
        devEmail: user.email,
        ttl: RESET_TOKEN_TTL_MINUTES
      });
    }

    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        name: user.name,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES
      });
      req.flash('success_msg', genericMessage);
    } catch (err) {
      console.error('Password reset email failed:', err.message);
      req.flash('error_msg', 'We could not send the reset email. Please try again later.');
    }

    return res.redirect('/auth/forgot-password?sent=1');
  } catch (err) {
    return next(err);
  }
});

// Reset Password Page
router.get('/reset-password/:token', async (req, res, next) => {
  try {
    const user = await User.findOne({
      resetPasswordToken: hashToken(req.params.token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      return res.render('auth/reset-password', { invalid: true });
    }

    return res.render('auth/reset-password', { token: req.params.token, invalid: false });
  } catch (err) {
    return next(err);
  }
});

// Reset Password Handle
router.post('/reset-password', async (req, res, next) => {
  const { token, password, confirm_password } = req.body;
  const backToForm = `/auth/reset-password/${token || ''}`;

  if (!token) {
    req.flash('error_msg', 'Invalid or expired reset link');
    return res.redirect('/auth/forgot-password');
  }

  if (!password || !confirm_password) {
    req.flash('error_msg', 'Please fill in both password fields');
    return res.redirect(backToForm);
  }

  if (!STRONG_PASSWORD.test(password)) {
    req.flash('error_msg', 'Password must be at least 8 characters with an uppercase letter, a lowercase letter and a number');
    return res.redirect(backToForm);
  }

  if (password !== confirm_password) {
    req.flash('error_msg', 'Passwords do not match');
    return res.redirect(backToForm);
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: new Date() }
    });

    if (!user) {
      req.flash('error_msg', 'This reset link is invalid or has expired');
      return res.redirect('/auth/forgot-password');
    }

    user.password = await hashPassword(password);
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    // Password reset => invalidate every active session and push subscription
    user.current_session_token = null;
    await user.save();
    await Subscription.deleteMany({ user: user._id });

    req.flash('success_msg', 'Password updated successfully. Please sign in.');
    return res.redirect('/auth/login');
  } catch (err) {
    return next(err);
  }
});

// Logout Handle
router.get('/logout', async (req, res, next) => {
  try {
    const sessionUser = req.session.user;
    const sessionToken = req.session.session_token;

    if (sessionUser && sessionToken) {
      await User.updateOne(
        {
          _id: sessionUser._id,
          current_session_token: sessionToken
        },
        {
          $set: { current_session_token: null }
        }
      );

      await Subscription.deleteMany({
        user: sessionUser._id,
        sessionToken
      });
    }

    await destroySession(req);
    res.clearCookie('connect.sid');
    return res.redirect('/auth/login');
  } catch (err) {
    return next(err);
  }
});

module.exports = router;
