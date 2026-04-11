const publicVapidKey = 'BMI45rPdlreUTrbeqJemgRIH1Do_o7tGbTtDlel9Msq-Y6GHG3AGKPlN8TAfowZ6DakYgKAZawVfHSaeZihxTXE';

// Check for service worker
if ('serviceWorker' in navigator) {
  send().catch(err => console.error(err));
}

// Register SW, Register Push, Send Push
async function send() {
  // Register Service Worker
  console.log('Registering service worker...');
  const register = await navigator.serviceWorker.register('/service-worker.js', {
    scope: '/'
  });
  console.log('Service Worker Registered...');

  // Check if permission is already granted
  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return;
    }
  }

  // Register Push
  console.log('Registering Push...');
  const subscription = await register.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
  });
  console.log('Push Registered...');

  // Send Subscription to server
  await fetch('/notifications/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
    headers: {
      'content-type': 'application/json'
    }
  });
  console.log('Subscription sent to server...');
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}