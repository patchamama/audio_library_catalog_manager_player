import { useState, useEffect } from 'react';
import type { Playlist, Song } from '@/lib/types';
import { getPlayListInfoById } from '@/services/ApiService';
import { CardPlayButton } from '@/components/CardPlayButton';
import { MusicsTable } from '@/components/MusicsTable';

export function PlaylistPage() {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const parts = window.location.pathname.split('/').filter(Boolean);
    const idx = parts.findIndex(p => p === 'playlist');
    const id = idx >= 0 ? parts[idx + 1] : null;
    if (!id) { setLoading(false); return; }

    getPlayListInfoById(id)
      .then(data => {
        setPlaylist(data.playlist ?? null);
        setSongs(data.songs ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="h-16 w-16 rounded-full border-8 border-zinc-700 border-t-green-500 animate-spin" />
      </div>
    );
  }

  if (!playlist) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 text-sm">
        Álbum no encontrado
      </div>
    );
  }

  return (
    <div
      className="relative flex flex-col h-full bg-zinc-900 overflow-x-hidden bg-gradient-to-t from-50% from-zinc-900 via-zinc-900/80"
      style={{ backgroundColor: playlist.color?.accent ?? '#1f2937' }}
    >
      <div className="md:hidden px-3 pt-3">
        <button
          className="text-zinc-300 text-sm"
          onClick={() => history.back()}
          aria-label="Volver"
        >
          ← Volver
        </button>
      </div>

      <header className="flex flex-col md:flex-row gap-5 md:gap-8 px-4 md:px-6 mt-4 md:mt-12 items-center md:items-start">
        <picture className="aspect-square w-1/2 md:w-52 md:h-52 flex-none">
          <img
            src={playlist.cover}
            alt={`Cover of ${playlist.title}`}
            className="object-cover w-full h-full shadow-lg"
          />
        </picture>

        <div className="flex flex-col justify-between w-full">
          <h2 className="hidden md:flex flex-1 items-end">Playlist</h2>
          <div>
            <h1 className="text-2xl md:text-5xl font-bold text-white line-clamp-2">
              {playlist.title}
            </h1>
          </div>
          <div className="flex-1 flex items-end">
            <div className="text-sm text-gray-300 font-normal">
              <div>
                <span>{playlist.artists.join(', ')}</span>
              </div>
              <p className="mt-1 text-xs md:text-sm">
                <span className="text-white">{songs.length} canciones</span>,{' '}
                colección local
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="pl-4 md:pl-6 pt-3 md:pt-6">
        <CardPlayButton id={playlist.id} size="large" />
      </div>

      <div className="relative z-10 px-6 pt-10" />

      <section className="px-3 md:p-6">
        <MusicsTable songs={songs} />
      </section>
    </div>
  );
}
