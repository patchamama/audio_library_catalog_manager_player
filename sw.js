const SHELL_CACHE = 'player-shell-v4';
const ALBUM_CACHE = 'player-album-v4'; // album audio + cover only
const QUEUE_CACHE = 'player-queue-v1'; // queue audio only (separate — never evicted by album changes)
const API_CACHE   = 'player-api-v3';

const AUDIO_EXTS = new Set(['mp3', 'ogg', 'm4a', 'webm']); // mp4 excluded — video streams directly
const VIDEO_EXTS = new Set(['mp4']);
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

const OFFLINE_HTML = `<!doctype html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sin conexión — Player</title>
<style>
  body{background:#010101;color:#fff;font-family:system-ui,sans-serif;
       display:grid;place-content:center;min-height:100vh;margin:0;
       text-align:center;padding:24px;box-sizing:border-box;gap:12px}
  h2{margin:0;font-size:1.4rem}
  p{margin:0;color:#71717a;font-size:.875rem;line-height:1.5}
  small{color:#52525b;font-size:.75rem}
</style>
</head>
<body>
<h2>Sin conexión</h2>
<p>Conectate a internet y recargá la página una vez<br>para que el reproductor funcione offline.</p>
<small>Se recargará automáticamente cuando haya conexión.</small>
<script>window.addEventListener('online',()=>location.reload());</script>
</body>
</html>`;

// Generation counters — abort in-progress jobs when a newer request arrives.
let cacheGeneration = 0;
let queueCacheGen   = 0;
let albumCacheAbortController = null;
let queueCacheAbortController = null;

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const resp = await fetch('/_audios/player/');
        if (!resp.ok) return;
        const clone = resp.clone();
        const html = await resp.text();
        await cache.put('/_audios/player/', clone);
        // Precache all _astro/ JS+CSS assets referenced in the HTML
        const assetUrls = new Set();
        for (const m of html.matchAll(/\/_audios\/player\/_astro\/[^\s"'<>?#]+/g)) {
          assetUrls.add(m[0]);
        }
        await Promise.all([...assetUrls].map(url =>
          fetch(url).then(r => { if (r.ok) return cache.put(url, r); }).catch(() => {})
        ));
      } catch { /* silent — offline during install is OK */ }
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== SHELL_CACHE && k !== ALBUM_CACHE && k !== QUEUE_CACHE && k !== API_CACHE)
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
      .then(async () => {
        // Backup precache: if install precache failed (e.g. SW installed offline), try again on activate
        const cache = await caches.open(SHELL_CACHE);
        const existing = await cache.match('/_audios/player/');
        if (!existing) {
          const resp = await fetch('/_audios/player/').catch(() => null);
          if (resp?.ok) await cache.put('/_audios/player/', resp);
        }
      })
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
  const isVideo = VIDEO_EXTS.has(ext);
  const isImage = IMAGE_EXTS.has(ext);
  // Shell: all JS/CSS/HTML/fonts for the Astro app at /_audios/player/ and webfonts
  const isShell = !isAudio && !isVideo && !isImage &&
    (pathname.startsWith('/_audios/player/') || pathname.startsWith('/fonts/'));
  const isApi = pathname === '/_audios/api.php' || pathname === '/_audios/categories.json';

  // Audio (mp3/ogg/m4a/webm): network-first, offline fallback with 206 range support for seeking.
  // Checks ALBUM_CACHE first, then QUEUE_CACHE — both hold audio files independently.
  if (isAudio) {
    event.respondWith(
      fetch(request).catch(async () => {
        const [albumCache, queueCache] = await Promise.all([
          caches.open(ALBUM_CACHE),
          caches.open(QUEUE_CACHE),
        ]);
        const fullResp = (await albumCache.match(new Request(request.url)))
                      ?? (await queueCache.match(new Request(request.url)));
        if (!fullResp) return new Response('Audio unavailable offline', { status: 503 });

        const rangeHeader = request.headers.get('Range');
        if (!rangeHeader) return fullResp;

        const blob = await fullResp.blob();
        const m = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (!m) return fullResp;

        const start = parseInt(m[1], 10);
        const end   = m[2] ? parseInt(m[2], 10) : blob.size - 1;

        return new Response(blob.slice(start, end + 1), {
          status: 206,
          headers: {
            'Content-Range':  `bytes ${start}-${end}/${blob.size}`,
            'Content-Length': String(end - start + 1),
            'Content-Type':   fullResp.headers.get('Content-Type') || 'audio/mpeg',
            'Accept-Ranges':  'bytes',
          },
        });
      })
    );
    return;
  }

  // Video (mp4): network-only — pure streaming, no caching (files too large)
  if (isVideo) return;

  // Images: cache-first (covers are small — instant from cache, network fallback)
  if (isImage) {
    event.respondWith(
      caches.open(ALBUM_CACHE).then(async cache => {
        const cached = await cache.match(request);
        return cached ?? fetch(request);
      }).catch(() => fetch(request))
    );
    return;
  }

  // App shell (JS/CSS/HTML/fonts): cache-first (stale-while-revalidate)
  // Serve instantly from cache; update in background when online.
  if (isShell) {
    event.respondWith((async () => {
      const cache  = await caches.open(SHELL_CACHE);
      const cached = await cache.match(request);

      const fetchAndCache = async () => {
        const r = await fetch(request);
        if (r.ok) await cache.put(request, r.clone());
        return r;
      };

      if (cached) {
        event.waitUntil(fetchAndCache().catch(() => {})); // background refresh
        return cached;
      }
      try {
        return await fetchAndCache();
      } catch {
        // Page requests (no file extension) → serve index so the app shell stays alive offline.
        // Asset requests (CSS/JS) → serve offline HTML (browser ignores bad asset responses anyway).
        const isPageUrl = pathname.endsWith('/') || pathname.endsWith('.html') || !pathname.includes('.');
        if (isPageUrl) {
          const index = await cache.match('/_audios/player/');
          if (index) return index;
        }
        return new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // API (api.php): stale-while-revalidate — offline catalog browsing
  if (isApi) {
    event.respondWith(
      caches.open(API_CACHE).then(async cache => {
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then(response => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => null);

        // Serve cached immediately; update in background
        if (cached) {
          event.waitUntil(networkFetch);
          return cached;
        }
        // No cache yet — wait for network
        const fresh = await networkFetch;
        return fresh ?? new Response('API unavailable offline', { status: 503 });
      })
    );
    return;
  }

  // Navigation catch-all: any navigation within scope not handled above (e.g. /_audios/)
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE);
      try {
        const r = await fetch(request);
        if (r.ok) await cache.put(request, r.clone());
        return r;
      } catch {
        return (await cache.match(request))
            ?? (await cache.match('/_audios/player/'))
            ?? new Response(OFFLINE_HTML, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
      }
    })());
    return;
  }

  // Everything else: network only
});

const broadcastAll = async (msg) => {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  clients.forEach(c => c.postMessage(msg));
};

// ─── Message handlers ──────────────────────────────────────────────────────
// SET_ALBUM_CACHE: check if album is cached; if not, clear ALBUM_CACHE entirely and download it.
//   Queue lives in QUEUE_CACHE — never touched by album logic.
// SET_QUEUE_CACHE: evict removed queue files from QUEUE_CACHE, download new ones.
// STOP_CACHE: aborts any in-progress album caching job.
self.addEventListener('message', async (event) => {
  const type = event.data?.type;

  // ── STOP_CACHE ────────────────────────────────────────────────────────────
  if (type === 'STOP_CACHE') {
    cacheGeneration++;
    queueCacheGen++;
    if (albumCacheAbortController) {
      try { albumCacheAbortController.abort(); } catch {}
      albumCacheAbortController = null;
    }
    if (queueCacheAbortController) {
      try { queueCacheAbortController.abort(); } catch {}
      queueCacheAbortController = null;
    }
    await broadcastAll({ type: 'CACHE_CANCELLED' });
    return;
  }

  // ── SET_ALBUM_CACHE ───────────────────────────────────────────────────────
  if (type === 'SET_ALBUM_CACHE') {
    // New album request always cancels any previous in-flight album caching job.
    cacheGeneration++;
    if (albumCacheAbortController) {
      try { albumCacheAbortController.abort(); } catch {}
      albumCacheAbortController = null;
      await broadcastAll({ type: 'CACHE_CANCELLED' });
    }
    const myGen = cacheGeneration;
    const abortController = new AbortController();
    albumCacheAbortController = abortController;
    const { audioUrls = [], coverUrl = null, playlistUrl = null } = event.data;

    // Cache the playlist page HTML so navigating to it works offline.
    if (playlistUrl) {
      try {
        const shellCache = await caches.open(SHELL_CACHE);
        if (!await shellCache.match(playlistUrl)) {
          const resp = await fetch(playlistUrl);
          if (resp.ok) await shellCache.put(playlistUrl, resp);
        }
      } catch { /* silent — may fail offline */ }
    }

    const audioOnly = audioUrls.filter(url => !String(url).toLowerCase().endsWith('.mp4'));
    const toCache   = [...new Set([...audioOnly, ...(coverUrl ? [coverUrl] : [])])];

    const cache = await caches.open(ALBUM_CACHE);

    // Always clear previous album cache before starting the new download.
    const existing = await cache.keys();
    await Promise.all(existing.map(req => cache.delete(req)));

    const total = toCache.length;
    let done = 0;
    if (total > 0) await broadcastAll({ type: 'CACHE_PROGRESS', done: 0, total });

    for (const url of toCache) {
      if (cacheGeneration !== myGen) {
        await broadcastAll({ type: 'CACHE_CANCELLED' });
        return;
      }
      try {
        const resp = await fetch(url, { signal: abortController.signal });
        if (cacheGeneration !== myGen || abortController.signal.aborted) {
          await broadcastAll({ type: 'CACHE_CANCELLED' });
          return;
        }
        if (resp.ok) await cache.put(url, resp);
      } catch (err) {
        // Abort = cancelled by a newer album request; stop immediately.
        if (abortController.signal.aborted || (err && err.name === 'AbortError')) {
          await broadcastAll({ type: 'CACHE_CANCELLED' });
          return;
        }
        /* silent per-file network error */
      }
      done++;
      if (cacheGeneration === myGen) await broadcastAll({ type: 'CACHE_PROGRESS', done, total });
    }
    if (cacheGeneration === myGen) albumCacheAbortController = null;
    return;
  }

  // ── SET_QUEUE_CACHE ───────────────────────────────────────────────────────
  if (type === 'SET_QUEUE_CACHE') {
    queueCacheGen++;
    if (queueCacheAbortController) {
      try { queueCacheAbortController.abort(); } catch {}
      queueCacheAbortController = null;
    }
    const myGen = queueCacheGen;
    const abortController = new AbortController();
    queueCacheAbortController = abortController;
    const { audioUrls = [] } = event.data;

    const newQueue = new Set(audioUrls.filter(url => !String(url).toLowerCase().endsWith('.mp4')));
    const cache    = await caches.open(QUEUE_CACHE);

    // Evict files no longer in queue.
    const keys = await cache.keys();
    await Promise.all(keys.map(req =>
      newQueue.has(req.url) ? null : cache.delete(req)
    ));

    // Download new queue files (silent, no progress bar).
    for (const url of newQueue) {
      if (queueCacheGen !== myGen) return; // newer SET_QUEUE_CACHE arrived
      try {
        if (!await cache.match(url)) {
          const resp = await fetch(url, { signal: abortController.signal });
          if (queueCacheGen !== myGen || abortController.signal.aborted) return;
          if (resp.ok) await cache.put(url, resp);
        }
      } catch (err) {
        if (abortController.signal.aborted || (err && err.name === 'AbortError')) return;
        /* silent */
      }
    }
    if (queueCacheGen === myGen) queueCacheAbortController = null;
    return;
  }
});
