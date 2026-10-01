const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { ensureAuthenticated, authorizeModule, authorizeRoles } = require('../middleware/auth');
const { MODULES } = require('../config/permissions');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.ADMIN_USERS));
router.use(authorizeRoles('admin'));

router.get('/users', adminController.listUsers);
router.post('/users/:id/reset-link', adminController.sendUserPasswordReset);
router.put('/users/:id/role', adminController.updateUserRole);

module.exports = router;
