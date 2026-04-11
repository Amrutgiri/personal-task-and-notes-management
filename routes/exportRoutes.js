const express = require('express');
const router = express.Router();
const exportController = require('../controllers/exportController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

router.get('/', ensureAuthenticated, authorizeModule(MODULES.EXPORT), exportController.exportData);

module.exports = router;
