const User = require('../models/User');
const bcrypt = require('bcryptjs');

// @desc    View Profile
// @route   GET /profile
exports.getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render('profile/index', {
      user,
      page: 'profile'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Edit Profile Form
// @route   GET /profile/edit
exports.editProfile = async (req, res) => {
  try {
    const user = await User.findById(req.session.user._id);
    res.render('profile/edit', {
      user,
      page: 'profile'
    });
  } catch (err) {
    console.error(err);
    res.render('error/500');
  }
};

// @desc    Update Profile
// @route   PUT /profile
exports.updateProfile = async (req, res) => {
  try {
    const { name, bio, phoneNumber } = req.body;
    const updateData = { name, bio, phoneNumber };

    if (req.file) {
      updateData.profileImage = req.file.path;
    }

    const user = await User.findByIdAndUpdate(req.session.user._id, updateData, { new: true });
    
    // Update session
    req.session.user.name = user.name;
    req.session.user.profileImage = user.profileImage;

    req.flash('success_msg', 'Profile updated successfully');
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to update profile');
    res.redirect('/profile/edit');
  }
};

// @desc    Update Password
// @route   PUT /profile/password
exports.updatePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.session.user._id);

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/profile/edit');
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    req.flash('success_msg', 'Password changed successfully');
    res.redirect('/profile');
  } catch (err) {
    console.error(err);
    req.flash('error_msg', 'Failed to change password');
    res.redirect('/profile/edit');
  }
};