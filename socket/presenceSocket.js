/**
 * Socket-based presence (online / offline) tracking.
 *
 * Every authenticated browser tab opens a socket. We keep a map of
 * userId -> Set(socketIds) so a user is "online" while at least one tab
 * (or window) is connected, and only flips to "offline" when the last
 * socket for that user disconnects.
 *
 * Events
 *   server -> client  presence:list    { online: [userId, ...] }
 *   server -> client  presence:update  { userId, online: boolean }
 *   client -> server  presence:request (asks for a fresh list)
 */

const onlineUsers = new Map(); // userId -> Set<socketId>

const listOnline = () => Array.from(onlineUsers.keys());

module.exports = (io) => {
  io.on('connection', (socket) => {
    const session = socket.request.session;

    if (!session || !session.user || !session.user._id) {
      return;
    }

    const userId = session.user._id.toString();

    let sockets = onlineUsers.get(userId);
    const wasOffline = !sockets;

    if (!sockets) {
      sockets = new Set();
      onlineUsers.set(userId, sockets);
    }
    sockets.add(socket.id);

    // Tell this socket who is online right now.
    socket.emit('presence:list', { online: listOnline() });

    // Only broadcast the transition when the user actually came online,
    // so reopening a second tab does not spam every client.
    if (wasOffline) {
      socket.broadcast.emit('presence:update', { userId, online: true });
    }

    // Re-sent on demand (e.g. if the client missed the initial event).
    socket.on('presence:request', () => {
      socket.emit('presence:list', { online: listOnline() });
    });

    socket.on('disconnect', () => {
      const current = onlineUsers.get(userId);
      if (!current) return;

      current.delete(socket.id);

      if (current.size === 0) {
        onlineUsers.delete(userId);
        io.emit('presence:update', { userId, online: false });
      }
    });
  });
};

// Exposed for tests / diagnostics.
module.exports.getOnlineUsers = listOnline;
