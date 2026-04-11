const dotenv = require('dotenv');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('../config/db');
const User = require('../models/User');

dotenv.config();

const ADMIN_USER = {
  name: 'Admin User',
  email: 'apgoswami.eww@gmail.com',
  password: 'Password@123',
  role: 'admin'
};

const seedAdmin = async () => {
  try {
    await connectDB();

    const password = await bcrypt.hash(ADMIN_USER.password, 10);
    const existingUser = await User.findOne({ email: ADMIN_USER.email });

    if (existingUser) {
      existingUser.name = ADMIN_USER.name;
      existingUser.password = password;
      existingUser.role = ADMIN_USER.role;
      await existingUser.save();

      console.log(`Admin user updated: ${ADMIN_USER.email}`);
    } else {
      await User.create({
        ...ADMIN_USER,
        password
      });

      console.log(`Admin user created: ${ADMIN_USER.email}`);
    }
  } catch (error) {
    console.error('Admin seed failed:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

seedAdmin();
