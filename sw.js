const SHELL_CACHE = 'player-shell-v2';
const ALBUM_CACHE = 'player-album-v2';

const SHELL_EXTS = new Set(['html', 'js', 'css', 'woff', 'woff2', 'ttf', 'svg', 'json', 'webmanifest']);
const AUDIO_EXTS = new Set(['mp3', 'mp4', 'ogg', 'm4a', 'webm']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== ALBUM_CACHE).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.method !== 'GET') return;

  const pathname = url.pathname;
  const ext = pathname.split('.').pop()?.toLowerCase() ?? '';

  const isAudio = AUDIO_EXTS.has(ext);
  const isImage = IMAGE_EXTS.has(ext);
  const isShell = SHELL_EXTS.has(ext) &&
    (pathname.startsWith('/_audios/player/') || pathname.startsWith('/fonts/'));

  // Audio & images: serve from album cache only if pre-cached, otherwise pure network
  if (isAudio || isImage) {
    event.respondWith(
      caches.open(ALBUM_CACHE).then(async cache => {
        const cached = await cache.match(request);
        return cached ?? fetch(request);
      }).catch(() => fetch(request))
    );
    return;
  }

  // App shell (JS/CSS/HTML/fonts): network-first, cache fallback for offline
  if (isShell) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response.ok) caches.open(SHELL_CACHE).then(c => c.put(request, response.clone()));
          return response;
        })
        .catch(() =>
          caches.open(SHELL_CACHE)
            .then(c => c.match(request))
            .then(c => c ?? new Response('Offline', { status: 503 }))
        )
    );
    return;
  }

  // Everything else (API, PHP): network only, no caching
});

// Player sends SET_ALBUM_CACHE when the active album changes
self.addEventListener('message', async (event) => {
  if (event.data?.type !== 'SET_ALBUM_CACHE') return;

  const { audioUrls = [], coverUrl = null } = event.data;
  const allowed = new Set([...audioUrls, ...(coverUrl ? [coverUrl] : [])]);

  const cache = await caches.open(ALBUM_CACHE);

  // Evict anything cached that doesn't belong to the new album
  const keys = await cache.keys();
  await Promise.all(keys.map(req => allowed.has(req.url) ? null : cache.delete(req)));

  // Pre-cache cover first (small), then audio files sequentially
  const toCache = [...(coverUrl ? [coverUrl] : []), ...audioUrls];
  for (const url of toCache) {
    try {
      if (await cache.match(url)) continue;
      const resp = await fetch(url);
      if (resp.ok) await cache.put(url, resp);
    } catch { /* silent per-file */ }
  }
});
