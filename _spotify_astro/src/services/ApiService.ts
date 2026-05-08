const PHP_API        = '/_audios/api.php';
const SW_ALBUM_CACHE = 'player-album-v4';
const SW_API_CACHE   = 'player-api-v3';

// Single in-flight promise shared across all callers — prevents duplicate HTTP requests
let _apiPromise: Promise<any> | null = null;

export function fetchAllData(): Promise<{ playlists: any[]; songs: any[] }> {
  if (!_apiPromise) {
    _apiPromise = fetch(PHP_API)
      .then(r => { if (!r.ok) throw new Error('PHP API unavailable'); return r.json(); })
      .catch(() => { _apiPromise = null; throw new Error(); });
  }
  return _apiPromise;
}

export interface PlaylistPage {
  playlists: any[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export function fetchPlaylists(page = 1, limit = 48): Promise<PlaylistPage> {
  return fetch(`${PHP_API}?page=${page}&limit=${limit}`)
    .then(r => { if (!r.ok) throw new Error('PHP API unavailable'); return r.json(); });
}

function parsePlaylistData(data: any, playListId: number | string) {
  const playlist = data.playlists
    ? data.playlists.find(
        (p: any) => String(p.id) === String(playListId) || String(p.albumId) === String(playListId)
      )
    : data.playlist;
  const rawSongs = data.songs || [];
  const songs = rawSongs
    .filter((s: any) => !playlist || s.albumId === playlist?.albumId)
    .map((s: any) => {
      const url = String(s.url || '').toLowerCase();
      const inferredMediaType = url.endsWith('.mp4') ? 'video' : 'audio';
      return { ...s, mediaType: s.mediaType === 'video' ? 'video' : inferredMediaType };
    });
  return { playlist, songs };
}

export async function getPlaylistsFromSwCache(): Promise<{ playlists: any[]; totalPages: number } | null> {
  if (typeof window === 'undefined' || !('caches' in window)) return null;
  try {
    const cache = await caches.open(SW_API_CACHE);
    for (const limit of [48, 120, 24, 50, 60]) {
      const resp = await cache.match(`${PHP_API}?page=1&limit=${limit}`);
      if (resp?.ok) {
        const data = await resp.json();
        if (Array.isArray(data.playlists) && data.playlists.length > 0)
          return { playlists: data.playlists, totalPages: data.totalPages ?? 1 };
      }
    }
    const keys = await cache.keys();
    for (const req of keys) {
      if (req.url.includes('/api.php')) {
        const resp = await cache.match(req);
        if (resp?.ok) {
          const data = await resp.json();
          if (Array.isArray(data.playlists) && data.playlists.length > 0)
            return { playlists: data.playlists, totalPages: data.totalPages ?? 1 };
        }
      }
    }
  } catch {}
  return null;
}

export async function getCachedAudioFiles(): Promise<string[]> {
  if (typeof window === 'undefined' || !('caches' in window)) return [];
  try {
    const cache = await caches.open(SW_ALBUM_CACHE);
    const keys = await cache.keys();
    return keys
      .map(req => req.url)
      .filter(url => /\.(mp3|ogg|m4a|webm)$/i.test(url));
  } catch {}
  return [];
}

export async function getCachedAlbumInfo(): Promise<{ audioUrls: string[]; coverUrl: string | null; fileSizes: Record<string, number> }> {
  if (typeof window === 'undefined' || !('caches' in window)) return { audioUrls: [], coverUrl: null, fileSizes: {} };
  try {
    const cache = await caches.open(SW_ALBUM_CACHE);
    const keys = await cache.keys();
    const urls = keys.map(req => req.url);
    const audioUrls = urls.filter(url => /\.(mp3|ogg|m4a|webm)$/i.test(url));
    const coverUrl = urls.find(url => /\.(jpg|jpeg|png|webp)$/i.test(url)) ?? null;
    const fileSizes: Record<string, number> = {};
    await Promise.all(audioUrls.map(async (url) => {
      const resp = await cache.match(url);
      if (!resp) return;
      const cl = resp.headers.get('content-length');
      if (cl) fileSizes[url] = parseInt(cl, 10);
    }));
    return { audioUrls, coverUrl, fileSizes };
  } catch {}
  return { audioUrls: [], coverUrl: null, fileSizes: {} };
}

export async function getPlayListInfoById(playListId: number | string) {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  // Try dedicated albumId endpoint first — returns only that album's data (fast)
  // Normalize: accept both 21 and "album-21" string formats
  const numericId = String(playListId).replace(/^album-/, '');
  try {
    const res = await fetch(`${PHP_API}?albumId=${numericId}`);
    if (res.ok) {
      const data = await res.json();
      if (data.playlist) {
        const songs = (data.songs || []).map((s: any) => {
          const url = String(s.url || '').toLowerCase();
          const inferredMediaType = url.endsWith('.mp4') ? 'video' : 'audio';
          return { ...s, mediaType: s.mediaType === 'video' ? 'video' : inferredMediaType };
        });
        return { playlist: data.playlist, songs };
      }
    }
  } catch { /* fall through */ }

  // Fallback: full catalog (legacy)
  try {
    return parsePlaylistData(await fetchAllData(), playListId);
  } catch {
    const res = await fetch(`${base}api/get-info-playlist.json`);
    return parsePlaylistData(await res.json(), playListId);
  }
}
