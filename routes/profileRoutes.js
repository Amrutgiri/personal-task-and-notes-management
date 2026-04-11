const express = require('express');
const router = express.Router();
const profileController = require('../controllers/profileController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { MODULES } = require('../config/permissions');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.PROFILE));

router.get('/', profileController.getProfile);
router.get('/edit', profileController.editProfile);
router.put('/', upload.single('profileImage'), profileController.updateProfile);
router.put('/password', profileController.updatePassword);

module.exports = router;
