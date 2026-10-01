const crypto = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const { normalizeRole } = require('../config/permissions');
const emailService = require('../services/emailService');

const RESET_TOKEN_TTL_MINUTES = 30;
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

exports.listUsers = async (req, res) => {
  try {
    const users = (await User.find({}, 'name email role createdAt').sort({ createdAt: -1 }).lean()).map((user) => ({
      ...user,
      role: normalizeRole(user.role)
    }));
    res.render('admin/users', {
      page: 'admin-users',
      users
    });
  } catch (error) {
    console.error(error);
    res.render('error/500');
  }
};

/**
 * Admin-only: generate a password reset link for a user and email it to them.
 * The user's current session and push subscriptions are revoked so the next
 * login starts fresh.
 */
exports.sendUserPasswordReset = async (req, res) => {
  const { id } = req.params;
  const genericError = 'Failed to send the reset link. Please try again.';

  try {
    const targetUser = await User.findById(id);

    if (!targetUser) {
      req.flash('error_msg', 'User not found.');
      return res.redirect('/admin/users');
    }

    if (`${targetUser._id}` === `${req.session.user._id}`) {
      req.flash('error_msg', 'Use "Forgot password" on the sign-in page to reset your own password.');
      return res.redirect('/admin/users');
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    targetUser.resetPasswordToken = hashToken(rawToken);
    targetUser.resetPasswordExpires = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000);
    // Force re-login everywhere before the new password can be set.
    targetUser.current_session_token = null;
    await targetUser.save();
    await Subscription.deleteMany({ user: targetUser._id });

    const resetUrl = `${req.protocol}://${req.get('host')}/auth/reset-password/${rawToken}`;

    // Dev fallback: no SMTP configured -> show the link on screen so admins can
    // still hand it to the user (e.g. paste into a chat).
    if (!emailService.isEmailConfigured()) {
      return res.render('admin/reset-link', {
        page: 'admin-users',
        targetUser: { name: targetUser.name, email: targetUser.email },
        resetUrl,
        ttl: RESET_TOKEN_TTL_MINUTES
      });
    }

    try {
      await emailService.sendAdminPasswordResetEmail({
        to: targetUser.email,
        name: targetUser.name,
        adminName: req.session.user.name,
        resetUrl,
        expiresInMinutes: RESET_TOKEN_TTL_MINUTES
      });
      req.flash('success_msg', `A password reset link was sent to ${targetUser.email}.`);
    } catch (err) {
      console.error('Admin reset email failed:', err.message);
      req.flash('error_msg', genericError);
    }

    return res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', genericError);
    return res.redirect('/admin/users');
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, {
      $set: { role: normalizeRole(req.body.role) }
    });

    if (`${req.session.user._id}` === `${req.params.id}`) {
      req.session.user.role = normalizeRole(req.body.role);
    }

    req.flash('success_msg', 'User role updated successfully.');
    res.redirect('/admin/users');
  } catch (error) {
    console.error(error);
    req.flash('error_msg', 'Failed to update user role.');
    res.redirect('/admin/users');
  }
};
