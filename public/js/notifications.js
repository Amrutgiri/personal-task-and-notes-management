(function () {
  // The VAPID public key is injected from the server (set on <body data-vapid-public-key>)
  // so the client never drifts out of sync with the private key in `.env`.
  const publicVapidKey = (document.body && document.body.dataset.vapidPublicKey) || '';

  const SUBSCRIBED_FLAG = 'push_subscribed';

  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !publicVapidKey) {
    return;
  }

  // Re-use the same service worker registration as the rest of the app.
  navigator.serviceWorker.register('/service-worker.js', { scope: '/' })
    .then(function (registration) {
      return ensurePushSubscription(registration);
    })
    .catch(function (err) {
      console.error('Push setup failed:', err);
    });

  async function ensurePushSubscription(registration) {
    // Ask for permission only when the browser hasn't decided yet. If the user
    // previously blocked notifications, do not nag — silently give up.
    if (Notification.permission === 'denied') {
      return;
    }
    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        return;
      }
    }

    let subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });
    }

    await syncSubscription(subscription);

    // Push endpoints can be rotated by the push service; re-sync when the tab
    // regains focus so the server always has a fresh, valid subscription row.
    window.addEventListener('focus', function () {
      registration.pushManager.getSubscription().then(function (sub) {
        if (sub) syncSubscription(sub);
      });
    });
  }

  async function syncSubscription(subscription) {
    try {
      const res = await fetch('/notifications/subscribe', {
        method: 'POST',
        body: JSON.stringify(subscription.toJSON()),
        headers: { 'content-type': 'application/json' }
      });
      if (res.ok) {
        localStorage.setItem(SUBSCRIBED_FLAG, '1');
      }
    } catch (err) {
      console.error('Subscription sync failed:', err);
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }
})();