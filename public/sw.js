self.addEventListener('push', (event) => {
  const fallback = {
    title: 'Re:Me',
    body: 'Re:Me — あなた宛ての手紙が届いています。',
  }
  let payload = fallback

  try {
    const parsed = event.data?.json()
    if (parsed && typeof parsed === 'object') {
      payload = {
        title: typeof parsed.title === 'string' ? parsed.title : fallback.title,
        body: typeof parsed.body === 'string' ? parsed.body : fallback.body,
      }
    }
  } catch {
    payload = fallback
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request))
})
