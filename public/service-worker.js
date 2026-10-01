self.addEventListener('push', function (event) {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'ZenNotes', body: event.data.text() };
  }

  const targetUrl = data.url || '/chat';
  const options = {
    // `body`/`icon` must be present-safe: undefined body makes showNotification reject
    // and the push is silently dropped.
    body: data.body || 'You have a new message',
    icon: data.icon || '/img/default-avatar.png',
    badge: '/img/default-avatar.png',
    tag: data.chatId ? 'chat-' + data.chatId : undefined,
    data: {
      chatId: data.chatId,
      url: targetUrl
    },
    vibrate: [100, 50, 100],
    actions: [{ action: 'open_target', title: data.chatId ? 'Open Chat' : 'Open' }]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'ZenNotes', options)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it and navigate to the requested page
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus().then(function (focused) {
            try { return focused.navigate(targetUrl); } catch (e) { return focused; }
          });
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
