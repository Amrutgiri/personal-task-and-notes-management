const express = require('express');
const router = express.Router();
const searchController = require('../controllers/searchController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

router.get('/', ensureAuthenticated, authorizeModule(MODULES.SEARCH), searchController.globalSearch);

module.exports = router;
