import { useEffect, useMemo, useRef, useState } from "react";
import type { Playlist, Song } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { normalizeSongMediaType } from "@/lib/media";

interface Props {
  playlists: Playlist[];
  songs: Song[];
  baseUrl: string;
}

const PAGE_SIZE = 48;
const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export function AlbumBrowser({ playlists, songs, baseUrl }: Props) {
  const [albumQuery, setAlbumQuery] = useState("");
  const [contentQuery, setContentQuery] = useState("");
  const [mobileQuery, setMobileQuery] = useState("");
  const [mobileSection, setMobileSection] = useState<"home" | "search" | "library" | "queue">("home");
  const [isMobile, setIsMobile] = useState(false);
  const [navLoading, setNavLoading] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const { queue, removeFromQueue, clearQueue, setCurrentMusic, setIsPlaying, currentMusic, addToQueue, setMobilePlayerVisible } = usePlayerStore((s) => s);
  const queueSet = useMemo(() => new Set(queue.map((q) => `${q.albumId}-${q.id}-${q.url}`)), [queue]);

  const filteredAlbums = useMemo(() => {
    const aQ = normalizeForSearch(albumQuery);
    return playlists.filter((p) => {
      if (!aQ) return true;
      const title = normalizeForSearch(p.title);
      const artists = normalizeForSearch(p.artists.join(", "));
      return title.includes(aQ) || artists.includes(aQ);
    });
  }, [playlists, albumQuery]);

  const filteredSongs = useMemo(() => {
    const cQ = normalizeForSearch(contentQuery);
    if (!cQ) return [];
    const albumById = new Map<number, Playlist>();
    playlists.forEach((p) => albumById.set(p.albumId, p));
    return songs
      .filter((s) => normalizeForSearch(s.title).includes(cQ))
      .map((s) => ({ song: s, album: albumById.get(s.albumId) }))
      .filter((x) => !!x.album) as Array<{ song: Song; album: Playlist }>;
  }, [contentQuery, songs, playlists]);

  const mode = normalizeForSearch(contentQuery) ? "songs" : "albums";
  const sourceLen = mode === "songs" ? filteredSongs.length : filteredAlbums.length;
  const pagedAlbums = filteredAlbums.slice(0, visible);
  const pagedSongs = filteredSongs.slice(0, visible);
  const searchAlbums = filteredAlbums.slice(0, 120);
  const searchSongs = filteredSongs.slice(0, 120);
  const mobileTokens = normalizeForSearch(mobileQuery).split(/\s+/).filter(Boolean);
  const mobileSearchAlbums = useMemo(() => {
    if (mobileTokens.length === 0) return playlists.slice(0, 120);
    return playlists.filter((p) => {
      const title = normalizeForSearch(p.title);
      return mobileTokens.some((t) => title.includes(t));
    });
  }, [playlists, mobileTokens]);
  const mobileSearchSongs = useMemo(() => {
    if (mobileTokens.length === 0) return [];
    const byId = new Map<number, Playlist>();
    playlists.forEach((p) => byId.set(p.albumId, p));
    return songs
      .filter((s) => {
        const title = normalizeForSearch(s.title);
        const artists = normalizeForSearch(s.artists.join(" "));
        const album = normalizeForSearch(s.album);
        return mobileTokens.some((t) => title.includes(t) || artists.includes(t) || album.includes(t));
      })
      .map((song) => ({ song, album: byId.get(song.albumId) }))
      .filter((x) => !!x.album) as Array<{ song: Song; album: Playlist }>;
  }, [songs, playlists, mobileTokens]);

  useEffect(() => {
    const sync = () => {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      setIsMobile(mobile);
      const raw = window.location.hash.replace("#", "").toLowerCase();
      if (raw === "search" || raw === "library" || raw === "home" || raw === "queue") {
        setMobileSection(raw as "home" | "search" | "library" | "queue");
      } else {
        setMobileSection("home");
      }
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("resize", sync);
    return () => {
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const onClick = (event: Event) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const link = target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      if (href.includes("/playlist/")) {
        setMobilePlayerVisible(true);
      }
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, [isMobile, setMobilePlayerVisible]);

  useEffect(() => {
    const onMobileSelect = (event: Event) => {
      const detail = (event as CustomEvent<{ section?: string }>).detail;
      const section = detail?.section;
      if (section === "home" || section === "search" || section === "library" || section === "queue") {
        setMobileSection(section);
      }
    };
    document.addEventListener("mobile-nav-select", onMobileSelect);
    return () => document.removeEventListener("mobile-nav-select", onMobileSelect);
  }, []);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [albumQuery, contentQuery]);

  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      setVisible((v) => Math.min(v + PAGE_SIZE, sourceLen));
    }, { root: null, threshold: 0.1 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [sourceLen, mode]);

  useEffect(() => {
    if (!navLoading) return;
    const id = window.setTimeout(() => setNavLoading(false), 1400);
    return () => window.clearTimeout(id);
  }, [navLoading]);

  if (isMobile) {
    return (
      <section className="px-0 pt-4 pb-24 relative">
        {navLoading && (
          <div className="fixed inset-0 z-[1000] grid place-content-center bg-black/65">
            <div className="h-24 w-24 rounded-full border-8 border-zinc-700 border-t-green-500 animate-spin"></div>
          </div>
        )}
        {mobileSection === "home" && (
          <div id="home" className="px-3">
            <h2 className="text-xl font-semibold mb-4">Inicio</h2>
            <div className="grid grid-cols-2 gap-3">
              {playlists.map((playlist) => (
                <a key={playlist.id} href={`${baseUrl}playlist/${playlist.id}/`} className="rounded-lg bg-zinc-800/80 p-2.5" onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}>
                  <img src={playlist.cover} alt={playlist.title} className="w-full aspect-square object-cover rounded-md scale-[0.96]" loading="lazy" />
                  <div className="mt-2 text-sm text-zinc-100 line-clamp-2">{playlist.title}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {mobileSection === "search" && (
          <div id="search" className="px-[2px]">
            <h2 className="text-xl font-semibold mb-4">Buscar</h2>
            <div className="grid gap-2">
              <input
                className="bg-zinc-800 rounded-md px-3 py-2 text-sm outline-none"
                placeholder="Buscar álbumes o audios"
                value={mobileQuery}
                onChange={(e) => setMobileQuery(e.target.value)}
              />
            </div>
            <div className="mt-4 space-y-2">
              {mobileSearchAlbums.map((playlist) => (
                <a key={`a-${playlist.id}`} href={`${baseUrl}playlist/${playlist.id}/`} className="flex items-center gap-3 rounded-md bg-zinc-800/70 px-2 py-2" onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}>
                  <div className="relative w-10 h-10 shrink-0">
                    <img src={playlist.cover} alt={playlist.title} className="absolute left-0 top-0 w-8 h-8 rounded object-cover opacity-85" />
                    <img src={playlist.cover} alt={playlist.title} className="absolute left-2 top-2 w-8 h-8 rounded object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400">Álbum</div>
                    <div className="text-sm text-zinc-100 truncate">{playlist.title}</div>
                  </div>
                </a>
              ))}
              {mobileSearchSongs.map(({ song, album }) => (
                <a
                  key={`s-${song.url}`}
                  href={`${baseUrl}playlist/${album.id}/`}
                  className="flex items-center gap-3 rounded-md bg-zinc-800/70 px-3 py-2"
                  onClick={() => {
                    setNavLoading(true);
                    setMobilePlayerVisible(true);
                    if (typeof window === "undefined") return;
                    localStorage.setItem("player:state", JSON.stringify({
                      albumId: album.albumId,
                      songId: song.id,
                      url: song.url,
                      time: 0,
                    }));
                    localStorage.setItem("player:activeAlbum", String(album.albumId));
                    localStorage.setItem("player:activeSong", String(song.id));
                  }}
                >
                  <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover" />
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400">Audio</div>
                    <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                  </div>
                  <button
                    className="ml-auto text-xs bg-zinc-700 hover:bg-zinc-600 rounded px-2 py-1"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      addToQueue(normalizeSongMediaType(song));
                    }}
                    title="Agregar a cola"
                  >
                    {queueSet.has(`${song.albumId}-${song.id}-${song.url}`) ? "✓" : "＋"}
                  </button>
                </a>
              ))}
            </div>
          </div>
        )}

        {mobileSection === "library" && (
          <div id="library" className="px-0">
            <h2 className="text-xl font-semibold mb-4">Tu biblioteca</h2>
            <div className="space-y-0">
              {playlists.map((playlist) => (
                <a key={playlist.id} href={`${baseUrl}playlist/${playlist.id}/`} className="flex items-center gap-3 bg-zinc-800/70 px-[2px] py-2 w-full" onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}>
                  <img src={playlist.cover} alt={playlist.title} className="w-14 h-14 rounded object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm text-zinc-300 truncate">{playlist.title}</div>
                    <div className="text-xs text-zinc-400 truncate">{playlist.artists.join(", ")}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {mobileSection === "queue" && (
          <div id="queue" className="px-[2px]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Cola</h2>
              <div className="flex gap-2">
                <button
                  className="text-xs bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded"
                  onClick={() => {
                    if (queue.length === 0) return;
                    const nextSong = normalizeSongMediaType(queue[0]);
                    setCurrentMusic({ ...currentMusic, songs: queue.map(normalizeSongMediaType), song: nextSong });
                    setIsPlaying(true);
                    setMobilePlayerVisible(true);
                  }}
                >
                  Reproducir todo
                </button>
                <button className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded" onClick={clearQueue}>Limpiar</button>
              </div>
            </div>
            <div className="space-y-2">
              {queue.length === 0 && <div className="text-sm text-zinc-400">Sin elementos en cola.</div>}
              {queue.map((song, index) => (
                <div key={`${song.url}-${index}`} className="flex items-center gap-3 rounded-md bg-zinc-800/70 px-1 py-2">
                  <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                    <div className="text-xs text-zinc-400 truncate">{song.artists.join(", ")}</div>
                  </div>
                  <button className="text-xs text-red-300 hover:text-red-200" onClick={() => removeFromQueue(index)} title="Quitar de cola">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 grid gap-2 md:grid-cols-2">
        <label className="flex items-center gap-2 bg-zinc-800/80 rounded-md px-3 py-2">
          <span aria-hidden="true">🔎</span>
          <input
            className="bg-transparent outline-none w-full text-sm"
            placeholder="Buscar álbum o autor"
            value={albumQuery}
            onChange={(e) => setAlbumQuery(e.target.value)}
          />
        </label>
        <label className="flex items-center gap-2 bg-zinc-800/80 rounded-md px-3 py-2">
          <span aria-hidden="true">🎵</span>
          <input
            className="bg-transparent outline-none w-full text-sm"
            placeholder="Buscar contenido dentro de álbumes"
            value={contentQuery}
            onChange={(e) => setContentQuery(e.target.value)}
          />
        </label>
      </div>

      <p className="text-sm text-zinc-400 mt-2">
        {mode === "songs"
          ? `Resultados: ${filteredSongs.length} audios por contenido.`
          : `Resultados: ${filteredAlbums.length} álbumes.`}
      </p>

      {mode === "albums" && (
        <div className="flex flex-wrap mt-6 gap-4">
          {pagedAlbums.map((playlist) => (
            <a
              key={playlist.id}
              href={`${baseUrl}playlist/${playlist.id}/`}
              className="group relative hover:bg-zinc-800 shadow-lg hover:shadow-xl bg-zinc-500/30 rounded-md transition-all duration-300 flex p-2 overflow-hidden gap-2 pb-6 w-44 flex-col"
            >
              <picture className="w-40 h-40 flex-none overflow-hidden rounded-md bg-zinc-900">
                <img
                  src={playlist.cover}
                  alt={`Cover of ${playlist.title}`}
                  className="object-cover w-full h-full rounded-md"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = `${baseUrl}default-cover.svg`;
                  }}
                />
              </picture>
              <div className="flex flex-auto flex-col px-2">
                <h4 className="text-white text-sm">{playlist.title}</h4>
                <span className="text-xs text-gray-400">{playlist.artists.join(", ")}</span>
              </div>
            </a>
          ))}
        </div>
      )}

      {mode === "songs" && (
        <div className="grid gap-2 mt-6">
          {pagedSongs.map(({ song, album }) => (
            <a
              key={song.url}
              href={`${baseUrl}playlist/${album.id}/`}
              className="flex items-center gap-3 rounded-md bg-zinc-800/70 hover:bg-zinc-700 px-3 py-2"
            >
              <img src={song.image} alt={song.title} className="w-12 h-12 object-cover rounded" />
              <div className="min-w-0">
                <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                <div className="text-xs text-zinc-400 truncate">{album.title}</div>
              </div>
            </a>
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-500">
        {visible < sourceLen ? "Cargando más..." : "Fin de resultados"}
      </div>
    </section>
  );
}
