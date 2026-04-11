const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

router.get('/', ensureAuthenticated, authorizeModule(MODULES.ANALYTICS), analyticsController.getAnalyticsDashboard);

module.exports = router;
