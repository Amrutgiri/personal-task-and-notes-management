const express = require('express');
const dotenv = require('dotenv');
// Load env vars immediately
dotenv.config();

const http = require('http');
const socketio = require('socket.io');
const mongoose = require('mongoose');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const connectMongo = require('connect-mongo');
const MongoStore = connectMongo.MongoStore || connectMongo.default;
const flash = require('connect-flash');
const methodOverride = require('method-override');
const path = require('path');
const connectDB = require('./config/db');
const { sessionGuard } = require('./middleware/auth');
const notificationService = require('./services/notificationService');
const accessService = require('./services/accessService');
const { MODULES } = require('./config/permissions');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketio(server);
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';
const sessionStoreOptions = { mongoUrl: process.env.MONGO_URI };
const sessionStore =
  typeof MongoStore.create === 'function'
    ? MongoStore.create(sessionStoreOptions)
    : new MongoStore(sessionStoreOptions);

if (isProduction) {
  // Vercel serves the app behind a proxy, so secure cookies need trusted proxy headers.
  app.set('trust proxy', 1);
}

// EJS
app.use(expressLayouts);
app.set('view engine', 'ejs');
app.set('layout', './layouts/main');

// Bodyparser
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// Method override
app.use(methodOverride('_method'));

// Static folder
app.use(express.static(path.join(__dirname, 'public')));

// Express Session
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'secret',
  resave: false,
  saveUninitialized: false,
  proxy: isProduction,
  store: sessionStore,
  cookie: {
    httpOnly: true,
    // 'auto' => secure only when the request actually arrives over HTTPS
    // (works behind the Vercel proxy, and keeps sessions working on http://localhost)
    secure: 'auto',
    sameSite: 'lax'
  }
});
// main server code
app.use(sessionMiddleware);
io.engine.use(sessionMiddleware);
app.set('io', io);
app.set('notificationService', notificationService);

app.use(sessionGuard);

// Connect flash
app.use(flash());

// Global variables (middleware for flash messages)
app.use((req, res, next) => {
  const sessionUser = req.session.user ? accessService.getUserContext(req.session.user) : null;
  if (sessionUser && req.session.user.role !== sessionUser.role) {
    req.session.user.role = sessionUser.role;
  }

  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  res.locals.old_email = req.flash('old_email')[0] || '';
  res.locals.user = sessionUser;
  res.locals.page = '';
  res.locals.vapidPublicKey = process.env.VAPID_PUBLIC_KEY || '';
  res.locals.permissions = sessionUser ? accessService.getRolePermissions(sessionUser.role) : [];
  res.locals.modules = MODULES;
  res.locals.canAccess = (moduleName) => Boolean(sessionUser && accessService.canAccessModule(sessionUser, moduleName));
  next();
});

// Routes
app.use('/', require('./routes/index'));
app.use('/auth', require('./routes/auth'));
app.use('/notes', require('./routes/notes'));
app.use('/categories', require('./routes/categories'));
app.use('/daily-notes', require('./routes/dailyNoteRoutes'));
app.use('/chat', require('./routes/chatRoutes'));
app.use('/profile', require('./routes/profileRoutes'));
app.use('/notifications', require('./routes/notificationRoutes'));
app.use('/export', require('./routes/exportRoutes'));
app.use('/tasks', require('./routes/taskRoutes'));
app.use('/analytics', require('./routes/analyticsRoutes'));
app.use('/search', require('./routes/searchRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

// 404 handler (must come after all routes)
app.use((req, res) => {
  // req.accepts('html') returns 'html' | false — false only when the client
  // explicitly refuses HTML (e.g. Accept: application/json).
  const wantsJson = req.originalUrl.startsWith('/api/') ||
    req.xhr ||
    req.accepts('html') === false;

  if (wantsJson) {
    return res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` });
  }
  return res.status(404).render('error/404');
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  if (res.headersSent) {
    return next(err);
  }

  const wantsJson = req.originalUrl.startsWith('/api/') ||
    req.xhr ||
    req.accepts('html') === false;

  if (wantsJson) {
    return res.status(err.status || 500).json({
      message: isProduction ? 'Internal server error' : err.message
    });
  }

  return res.status(err.status || 500).render('error/500');
});

// Socket.io Integration
require('./socket/chatSocket')(io);
require('./socket/sessionSocket')(io);
require('./socket/presenceSocket')(io);

const PORT = process.env.PORT || 5000;

if (require.main === module) {
  server.listen(PORT, console.log(`Server running on port ${PORT}`));
}

module.exports = app;
