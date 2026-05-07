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

  // Audio: network-first (zero SW overhead for streaming online).
  // Offline fallback: serve the pre-cached full file as a proper 206 range response
  // so the audio element can seek without buffering the entire file first.
  if (isAudio) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(ALBUM_CACHE);
        const fullResp = await cache.match(new Request(request.url));
        if (!fullResp) return new Response('Audio unavailable offline', { status: 503 });

        const rangeHeader = request.headers.get('Range');
        if (!rangeHeader) return fullResp;

        const blob = await fullResp.blob();
        const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (!m) return fullResp;

        const start = parseInt(m[1], 10);
        const end = m[2] ? parseInt(m[2], 10) : blob.size - 1;

        return new Response(blob.slice(start, end + 1), {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${blob.size}`,
            'Content-Length': String(end - start + 1),
            'Content-Type': fullResp.headers.get('Content-Type') || 'audio/mpeg',
            'Accept-Ranges': 'bytes',
          },
        });
      })
    );
    return;
  }

  // Images: cache-first (covers are small — instant load from cache, network fallback)
  if (isImage) {
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
