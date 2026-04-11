const User = require('../models/User');
const { normalizeRole } = require('../config/permissions');

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
