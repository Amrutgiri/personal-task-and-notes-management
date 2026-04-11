self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const targetUrl = data.url || '/chat';
    const options = {
      body: data.body,
      icon: data.icon || '/img/logo.png',
      badge: '/img/badge.png',
      data: {
        chatId: data.chatId,
        url: targetUrl
      },
      vibrate: [100, 50, 100],
      actions: data.chatId
        ? [{ action: 'open_target', title: 'Open Chat' }]
        : [{ action: 'open_target', title: 'Open' }]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = event.notification.data.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(function(clientList) {
      // If a window is already open, focus it and navigate to the requested page
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if ('focus' in client) {
          return client.focus().then(c => c.navigate(targetUrl));
        }
      }
      // If no window is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
