const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');
const { ensureAuthenticated, authorizeModule } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { MODULES } = require('../config/permissions');

router.use(ensureAuthenticated);
router.use(authorizeModule(MODULES.CHAT));

router.get('/', chatController.getChats);
router.get('/:id/messages', chatController.getMessages);
router.post('/private', chatController.createPrivateChat);
router.post('/group', chatController.createGroup);
router.post('/channel', chatController.createChannel);
router.post('/upload', upload.single('file'), chatController.uploadFile);
router.post('/:id/members', chatController.addMember);
router.delete('/:id/members/:userId', chatController.removeMember);
router.post('/:id/leave', chatController.leaveChat);

module.exports = router;
