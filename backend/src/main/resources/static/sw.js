// ============================================================
// RED404 SERVICE WORKER
// Web Push Notifications & Background Service
// ============================================================

self.addEventListener('install', function (event) {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', function (event) {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'RED404 Notification', body: event.data.text() };
    }
  }

  const title = data.title || 'RED404 Emergency Blood Network';
  const options = {
    body: data.body || 'You have an important update regarding your hospital application.',
    icon: data.icon || 'images/icon-192.png',
    badge: data.badge || 'images/icon-badge.png',
    data: {
      url: data.url || '/hospital-status.html'
    },
    tag: data.tag || 'hospital-status-update',
    renotify: true,
    requireInteraction: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/hospital-status.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
