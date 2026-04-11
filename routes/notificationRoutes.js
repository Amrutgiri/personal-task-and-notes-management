const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController');
const { ensureAuthenticated } = require('../middleware/auth');

router.post('/subscribe', ensureAuthenticated, notificationController.subscribe);
router.post('/unsubscribe', ensureAuthenticated, notificationController.unsubscribe);

module.exports = router;