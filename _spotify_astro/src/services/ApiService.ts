export function getPlayListInfoById(playListId: number | string) {
  const base = import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
  return fetch(`${base}api/get-info-playlist.json`)
    .then((res) => res.json())
    .then((data) => {
      const playlist = data.playlists.find((p: any) => String(p.id) === String(playListId) || String(p.albumId) === String(playListId));
      const songs = data.songs
        .filter((s: any) => s.albumId === playlist?.albumId)
        .map((s: any) => {
          const url = String(s.url || "").toLowerCase();
          const inferredMediaType = url.endsWith(".mp4") ? "video" : "audio";
          return { ...s, mediaType: s.mediaType === "video" ? "video" : inferredMediaType };
        });
      return { playlist, songs };
    });
}
