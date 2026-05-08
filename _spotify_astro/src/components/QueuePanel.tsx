import { useEffect, useState } from "react";
import { usePlayerStore } from "@/store/playerStore";
import { getCachedAudioFiles } from "@/services/ApiService";
import { normalizeSongMediaType } from "@/lib/media";
import type { Song } from "@/lib/types";

export function QueuePanel() {
  const queue = usePlayerStore(s => s.queue);
  const clearQueue = usePlayerStore(s => s.clearQueue);
  const removeFromQueue = usePlayerStore(s => s.removeFromQueue);
  const currentMusic = usePlayerStore(s => s.currentMusic);
  const setCurrentMusic = usePlayerStore(s => s.setCurrentMusic);
  const setIsPlaying = usePlayerStore(s => s.setIsPlaying);

  const [tab, setTab] = useState<'queue' | 'cache'>('queue');
  const [cachedUrls, setCachedUrls] = useState<string[]>([]);

  useEffect(() => {
    if (tab !== 'cache') return;
    getCachedAudioFiles().then(setCachedUrls);
  }, [tab]);

  const cachedSongs: Song[] = cachedUrls.map(url => {
    const known = currentMusic.songs.find(s => s.url === url);
    if (known) return known;
    const filename = decodeURIComponent(url.split('/').pop() ?? url);
    const title = filename.replace(/\.\w+$/, '').replace(/^\d+[-_. ]+/, '').trim();
    return { id: 0, albumId: 0, title, artists: [], image: '', album: '', duration: '', url, mediaType: 'audio' } as Song;
  });

  return (
    <div className="mt-3 p-2 rounded-md bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between mb-2">
        <div className="flex gap-1">
          <button
            onClick={() => setTab('queue')}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${tab === 'queue' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Cola
          </button>
          <button
            onClick={() => setTab('cache')}
            className={`text-xs px-2 py-0.5 rounded transition-colors ${tab === 'cache' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Caché
          </button>
        </div>
        {tab === 'queue' && (
          <button className="text-xs text-zinc-400 hover:text-zinc-200" onClick={clearQueue}>Limpiar</button>
        )}
        {tab === 'cache' && (
          <button
            className="text-xs text-zinc-400 hover:text-zinc-200"
            onClick={() => getCachedAudioFiles().then(setCachedUrls)}
            title="Actualizar"
          >
            ↺
          </button>
        )}
      </div>

      {tab === 'queue' && (
        <ul className="max-h-40 overflow-y-auto text-xs text-zinc-400 space-y-0.5">
          {queue.length === 0 && <li className="py-1 text-zinc-500">Sin elementos en cola</li>}
          {queue.map((s, i) => (
            <li key={`${s.url}-${i}`} className="flex items-center gap-1.5 py-0.5">
              <span className="shrink-0 text-zinc-600 w-4">{i + 1}.</span>
              <span className="truncate flex-1">{s.title}</span>
              <button
                className="text-red-400/70 hover:text-red-300 shrink-0 text-[10px]"
                onClick={() => removeFromQueue(i)}
                title="Quitar de cola"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      {tab === 'cache' && (
        <ul className="max-h-40 overflow-y-auto text-xs space-y-0.5">
          {cachedSongs.length === 0 && (
            <li className="py-1 text-zinc-500">Sin audio en caché</li>
          )}
          {cachedSongs.map(s => {
            const isCurrent = currentMusic.song?.url === s.url;
            return (
              <li
                key={s.url}
                className={`flex items-center gap-1.5 py-0.5 ${isCurrent ? 'text-green-400' : 'text-zinc-400'}`}
              >
                <button
                  className="text-green-500 hover:text-green-300 shrink-0"
                  title="Reproducir"
                  onClick={() => {
                    const songs = cachedSongs.map(normalizeSongMediaType);
                    setCurrentMusic({ ...currentMusic, songs, song: normalizeSongMediaType(s) });
                    setIsPlaying(true);
                  }}
                >
                  ▶
                </button>
                <span className="truncate">{s.title}</span>
                {isCurrent && <span className="text-green-400 text-[9px] shrink-0">●</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
