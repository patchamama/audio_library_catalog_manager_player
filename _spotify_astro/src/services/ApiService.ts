const PHP_API = '/_audios/api.php';

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

function parsePlaylistData(data: any, playListId: number | string) {
  const playlist = data.playlists.find(
    (p: any) => String(p.id) === String(playListId) || String(p.albumId) === String(playListId)
  );
  const songs = (data.songs || [])
    .filter((s: any) => s.albumId === playlist?.albumId)
    .map((s: any) => {
      const url = String(s.url || '').toLowerCase();
      const inferredMediaType = url.endsWith('.mp4') ? 'video' : 'audio';
      return { ...s, mediaType: s.mediaType === 'video' ? 'video' : inferredMediaType };
    });
  return { playlist, songs };
}

export async function getPlayListInfoById(playListId: number | string) {
  const base = import.meta.env.BASE_URL.endsWith('/')
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;

  try {
    return parsePlaylistData(await fetchAllData(), playListId);
  } catch {
    const res = await fetch(`${base}api/get-info-playlist.json`);
    return parsePlaylistData(await res.json(), playListId);
  }
}
