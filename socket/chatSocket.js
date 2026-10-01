const Chat = require('../models/Chat');
const Message = require('../models/Message');
const notificationService = require('../services/notificationService');

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log('New connection:', socket.id);

    // Join a specific chat room
    socket.on('join_chat', (chatId) => {
      socket.join(chatId);
      console.log(`User ${socket.id} joined chat ${chatId}`);
    });

    // Leave a specific chat room
    socket.on('leave_chat', (chatId) => {
      socket.leave(chatId);
      console.log(`User ${socket.id} left chat ${chatId}`);
    });

    // Handle sending message
    socket.on('send_message', async (data) => {
      const { chatId, content, type, fileUrl, fileName, fileSize, language } = data;

      try {
        // IMPORTANT: derive the sender from the authenticated session, never from
        // the client-supplied `senderId` — a stale/wrong value makes notifications
        // target the wrong user (one side silently receives no push).
        const sessionUser = socket.request.session && socket.request.session.user;
        const senderId = sessionUser && sessionUser._id ? String(sessionUser._id) : null;
        if (!senderId) {
          socket.emit('error', { message: 'You must be logged in to send messages' });
          return;
        }

        const chat = await Chat.findById(chatId).populate('participants');
        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Only participants may post
        const isParticipant = chat.participants.some(
          (p) => p && p._id && String(p._id) === senderId
        );
        if (!isParticipant) {
          socket.emit('error', { message: 'You are not a participant of this chat' });
          return;
        }

        // Permissions check for channels
        if (chat.type === 'channel' && Array.isArray(chat.admins)) {
          if (!chat.admins.some((a) => String(a) === senderId)) {
            socket.emit('error', { message: 'Only admins can send messages in this channel' });
            return;
          }
        }

        const message = await Message.create({
          chat: chatId,
          sender: senderId,
          type: type || 'text',
          content,
          language: language || 'javascript',
          file_url: fileUrl,
          file_name: fileName,
          file_size: fileSize
        });

        // Update chat's last message
        chat.last_message = message._id;
        await chat.save();

        const populatedMessage = await message.populate('sender', 'name profileImage');

        // Broadcast to all participants in the room
        io.to(chatId).emit('receive_message', populatedMessage);

        // Build the push payload. `content` can be undefined for file/video
        // uploads, so derive a readable body instead of pushing "undefined".
        const senderName = (populatedMessage.sender && populatedMessage.sender.name) || 'New message';
        const msgType = type || 'text';
        let body;
        if (msgType === 'text' || msgType === 'code') {
          body = content || 'Sent a message';
        } else if (fileName) {
          body = `Sent ${/^(image|video)$/.test(msgType) ? 'an' : 'a'} ${msgType}: ${fileName}`;
        } else {
          body = `Sent a ${msgType}`;
        }

        const pushPayload = {
          title: senderName,
          body,
          icon: (populatedMessage.sender && populatedMessage.sender.profileImage) || '/img/default-avatar.png',
          chatId: chatId,
          url: `/chat?open=${chatId}`
        };

        // Notify every other participant — identical branch for admin -> user
        // and user -> admin so notifications stay symmetric.
        chat.participants.forEach((participant) => {
          if (participant && participant._id && String(participant._id) !== senderId) {
            notificationService.sendPushNotification(participant._id, pushPayload);
          }
        });

      } catch (err) {
        console.error('Socket send_message error:', err);
        socket.emit('error', { message: 'Could not send the message' });
      }
    });

    // Handle typing indicator
    socket.on('typing', (data) => {
      const { chatId, userName } = data;
      socket.to(chatId).emit('user_typing', { chatId, userName });
    });

    socket.on('stop_typing', (data) => {
      const { chatId } = data;
      socket.to(chatId).emit('user_stop_typing', { chatId });
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
    });
  });
};