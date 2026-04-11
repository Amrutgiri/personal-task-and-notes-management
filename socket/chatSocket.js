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
      const { chatId, senderId, content, type, fileUrl, fileName, fileSize, language } = data;

      try {
        const chat = await Chat.findById(chatId).populate('participants');
        if (!chat) return;

        // Permissions check for channels
        if (chat.type === 'channel') {
          if (!chat.admins.includes(senderId)) {
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

        // Send Push Notifications to other participants
        const pushPayload = {
          title: populatedMessage.sender.name,
          body: type === 'text' ? content : `Sent a ${type}`,
          icon: populatedMessage.sender.profileImage,
          chatId: chatId,
          url: `/chat?open=${chatId}`
        };

        chat.participants.forEach(participant => {
          if (participant._id.toString() !== senderId.toString()) {
            notificationService.sendPushNotification(participant._id, pushPayload);
          }
        });

      } catch (err) {
        console.error('Socket send_message error:', err);
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