import type { Song } from "@/lib/types"
import {TimeIcon} from "@/icons/MusicsTableIcons"
import {MusicsTablePlay} from "@/components/MusicsTablePlay"
import {usePlayerStore} from "../store/playerStore";
import { getPlayListInfoById } from "@/services/ApiService";
import { useEffect, useMemo, useState } from "react";
import { normalizeSongMediaType } from "@/lib/media";

interface Props {
  songs: Song[]
}

export const MusicsTable = ({songs}: Props) => {
  const [query, setQuery] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const { currentMusic, setCurrentMusic, setIsPlaying, addToQueue, setTrackLoading, setMobilePlayerVisible } = usePlayerStore(state => state);
  const { queue } = usePlayerStore(state => state);
  const [durations, setDurations] = useState<Record<string, string>>({});
  const normalize = (value: string) =>
    value
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  const filteredSongs = useMemo(
    () => {
      const q = normalize(query);
      if (!q) return songs;
      return songs.filter((s) => {
        const title = normalize(s.title);
        const album = normalize(s.album);
        const artists = normalize(s.artists.join(" "));
        return title.includes(q) || album.includes(q) || artists.includes(q);
      });
    },
    [songs, query]
  );
  const { song: currentSong, playlist: currentPlaylist } = currentMusic;
  const queueSet = useMemo(() => new Set(queue.map((q) => `${q.albumId}-${q.id}-${q.url}`)), [queue]);

  useEffect(() => {
    const sync = () => setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  useEffect(() => {
    const next: Record<string, string> = {};
    let cancelled = false;
    filteredSongs.slice(0, 80).forEach((song) => {
      const audio = document.createElement("audio");
      audio.preload = "metadata";
      audio.src = song.url;
      audio.onloadedmetadata = () => {
        if (cancelled) return;
        const d = audio.duration;
        const m = Math.floor(d / 60);
        const s = Math.floor(d % 60).toString().padStart(2, "0");
        next[song.url] = `${m}:${s}`;
        setDurations((prev) => ({ ...prev, ...next }));
      };
    });
    return () => { cancelled = true; };
  }, [filteredSongs]);

  const playSong = async (song: Song) => {
    const normalizedSong = normalizeSongMediaType(song);

    setTrackLoading(true);
    if (currentMusic.playlist?.albumId === song.albumId) {
      setCurrentMusic({ ...currentMusic, songs, song: normalizedSong });
      setIsPlaying(true);
      setMobilePlayerVisible(true);
      return;
    }
    const data = await getPlayListInfoById(song.albumId);
    setCurrentMusic({ songs: data.songs, playlist: data.playlist, song: normalizedSong });
    setIsPlaying(true);
    setMobilePlayerVisible(true);
  };

  return (
    <div>
    <div className="mb-4">
      <label className="flex items-center gap-2 bg-zinc-800/80 rounded-md px-3 py-2">
        <span aria-hidden="true">🎵</span>
        <input
          className="bg-transparent outline-none w-full text-sm"
          placeholder="Buscar dentro del álbum"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
    </div>
    {isMobile ? (
      <div className="space-y-2">
        {filteredSongs.map((song, index) => (
          <div key={`${song.albumId}-${song.id}`} className="flex items-center gap-2 rounded-md bg-zinc-800/60 px-2 py-2">
            <div className="w-5 text-xs text-zinc-400 text-right">{index + 1}</div>
            <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm text-zinc-100 truncate" onClick={() => playSong(song)}>{song.title}</div>
              <div className="text-[11px] text-zinc-400 truncate">{song.artists.join(", ")} · {durations[song.url] ?? song.duration}</div>
            </div>
            <button
              className="text-xs bg-zinc-700 hover:bg-zinc-600 rounded px-2 py-1"
              onClick={() => addToQueue(normalizeSongMediaType(song))}
              title="Agregar a cola"
            >
              {queueSet.has(`${song.albumId}-${song.id}-${song.url}`) ? "✓" : "＋"}
            </button>
          </div>
        ))}
      </div>
    ) : (
    <table className="table-auto text-left min-w-full divide-y divide-gray-500/20">
      <thead className="">
      <tr className="text-zinc-400 text-sm">
        <th className="px-4 py-2 font-light">#</th>
        <th className="px-4 py-2 font-light">Título</th>
        <th className="px-4 py-2 font-light text-right"><TimeIcon /></th>
      </tr>
      </thead>

      <tbody>
      <tr className="h-[16px]"></tr>
      {
        filteredSongs.map((song, index) => {
            const isCurrentSongBoolean = currentSong?.id === song.id && currentPlaylist?.albumId === song.albumId;
            return (
              <tr
                key={`${song.albumId}-${song.id}`} className="text-gray-300 border-spacing-0 text-sm font-light hover:bg-white/10 overflow-hidden transition duration-300 group">
                <td className="relative px-4 py-2 rounded-tl-lg rounded-bl-lg w-5">
                  <span className="absolute top-5 opacity-100 transition-all group-hover:opacity-0">{index + 1}</span>
                  <div className="absolute top-5 opacity-0 transition-all group-hover:opacity-100">
                    <MusicsTablePlay song={song} isCurrentSong={isCurrentSongBoolean}/>
                  </div>
                </td>
                <td className="px-4 py-2 flex gap-3 max-w-[760px]">
                  <picture className="">
                    <img src={song.image} alt={song.title} className="w-11 h-11"/>
                  </picture>
                  <div className="flex flex-col min-w-0">
                    <h3 className={
                        `text-base font-normal cursor-pointer hover:underline truncate whitespace-nowrap
                        ${isCurrentSongBoolean ? "text-green-400" : "text-White"}
                        hover:animate-title-marquee
                        `
                      }
                        onClick={() => playSong(song)}
                      >{song.title}</h3>
                    <span>{song.artists.join(", ")}</span>
                  </div>
                </td>
                <td className="px-4 py-2 rounded-tr-lg rounded-br-lg text-right">
                  <div className="flex items-center justify-end gap-3">
                    <span>{durations[song.url] ?? song.duration}</span>
                    <button
                      className="text-xs bg-zinc-800 hover:bg-zinc-700 rounded px-2 py-1"
                      onClick={() => addToQueue(normalizeSongMediaType(song))}
                      title="Agregar a cola"
                    >
                      {queueSet.has(`${song.albumId}-${song.id}-${song.url}`) ? "✓" : "➕"}
                    </button>
                  </div>
                </td>
              </tr>
            )
          }
        )
      }
      </tbody>
    </table>
    )}
    <style>{`
      @keyframes title-marquee {
        0% { transform: translateX(0); }
        100% { transform: translateX(-28%); }
      }
      .hover\\:animate-title-marquee:hover {
        display: inline-block;
        animation: title-marquee 7s ease-in-out infinite alternate;
      }
    `}</style>
    </div>
  );
}
