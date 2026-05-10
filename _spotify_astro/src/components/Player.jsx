import { PlayerControlButtonBar } from "@/components/PlayerControlButtonBar";
import { PlayerCurrentSong } from "@/components/PlayerCurrentSong"
import { PlayerSoundControl } from "@/components/PlayerSoundControl"
import { PlayerVolumeControl } from "@/components/PlayerVolumeControl"
import { useCurrentMusic } from "@/hooks/UseCurrentMusic";
import { useEffect, useRef, useState } from "react"
import { usePlayerStore } from "@/store/playerStore"
import { getPlayListInfoById } from "@/services/ApiService";
import { normalizeSongMediaType } from "@/lib/media";
import { ChessVideoAnalyzer } from "@/components/ChessVideoAnalyzer";
import { Slider } from "@/components/Slider";


export function Player() {
  const currentMusic = usePlayerStore(state => state.currentMusic);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const isTrackLoading = usePlayerStore(state => state.isTrackLoading);
  const shuffleMode = usePlayerStore(state => state.shuffleMode);
  const repeatAllMode = usePlayerStore(state => state.repeatAllMode);
  const volume = usePlayerStore(state => state.volume);
  const setCurrentMusic = usePlayerStore(state => state.setCurrentMusic);
  const setVolume = usePlayerStore(state => state.setVolume);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const shiftQueue = usePlayerStore(state => state.shiftQueue);
  const queue = usePlayerStore(state => state.queue);
  const setTrackLoading = usePlayerStore(state => state.setTrackLoading);
  const audioRef = useRef();
  const videoRef = useRef();
  const prevSongUrlRef = useRef(null);
  const prevSongRef = useRef(null);
  const prevSongDataRef = useRef(null);
  const playHistoryRef = useRef([]);
  const isGoingBackRef = useRef(false);
  const maxListenedPercentRef = useRef(0);
  const dismissTimerRef = useRef(null);
  const isMobileRef = useRef(false);
  const lastCachedAlbumIdRef = useRef(null);
  const lastQueueSigRef = useRef('');
  const {getNextSong} = useCurrentMusic(currentMusic)
  const [isLoading, setIsLoading] = useState(false);
  const [cacheProgress, setCacheProgress] = useState(null);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [splitPct, setSplitPct] = useState(62);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [fitVideo, setFitVideo] = useState(true);
  const [videoAspectIndex, setVideoAspectIndex] = useState(0);
  const [videoPan, setVideoPan] = useState({ x: 0, y: 0 });
  const [showChessPanel, setShowChessPanel] = useState(true);
  const [playerUserId, setPlayerUserId] = useState(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [showAlbumModal, setShowAlbumModal] = useState(false);
  const [mobileTime, setMobileTime] = useState(0);
  const splitRef = useRef(null);
  const aspectModes = [
    { ratio: "1 / 1", label: "1:1", scale: 1, anchor: "center center" },
    { ratio: "2 / 1", label: "2:1", scale: 2, anchor: "left top" },
    { ratio: "3 / 1", label: "3:1", scale: 3, anchor: "left top" },
    { ratio: "4 / 1", label: "4:1", scale: 4, anchor: "left top" },
  ];
  const currentAspect = aspectModes[videoAspectIndex];
  const getMediaRef = (song = currentMusic.song) => song?.mediaType === "video" ? videoRef : audioRef;
  const getMediaElement = (song = currentMusic.song) => getMediaRef(song).current;
  const chessText = `${currentMusic.song?.title ?? ""} ${currentMusic.song?.album ?? ""} ${currentMusic.song?.artists?.join(" ") ?? ""} ${currentMusic.playlist?.title ?? ""} ${currentMusic.playlist?.artists?.join(" ") ?? ""}`.toLowerCase();
  const isChessVideoContext = chessText.includes("chess") || chessText.includes("ajedrez");
  const setPersistedState = (extra = {}) => {
    if (typeof window === "undefined") return;
    const media = getMediaElement();
    const currentTime = extra.time ?? media?.currentTime ?? 0;
    const duration = media?.duration;
    if (Number.isFinite(duration) && duration > 0) {
      const pct = Math.round((currentTime / duration) * 100);
      if (pct > maxListenedPercentRef.current) maxListenedPercentRef.current = pct;
    }
    const payload = {
      albumId: currentMusic.playlist?.albumId ?? null,
      songId: currentMusic.song?.id ?? null,
      url: currentMusic.song?.url ?? null,
      time: currentTime,
      volume,
      ...extra
    };
    localStorage.setItem("player:state", JSON.stringify(payload));
    if (payload.albumId) localStorage.setItem("player:activeAlbum", String(payload.albumId));
    if (payload.songId) localStorage.setItem("player:activeSong", String(payload.songId));
    if (!isMobileRef.current) {
      localStorage.setItem("player:volume", String(payload.volume ?? 0.5));
    }
  };
  const mediaForMobile = getMediaElement();
  const mobileDurationRaw = mediaForMobile?.duration || 0;
  const mobileDuration = Number.isFinite(mobileDurationRaw) && mobileDurationRaw > 0 ? mobileDurationRaw : 0;
  const safeMobileTime = Math.max(0, Math.min(mobileTime || 0, mobileDuration || Math.max(mobileTime || 0, 0)));

  useEffect(() => {
    const syncMobile = () => {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      setIsMobile(mobile);
      isMobileRef.current = mobile;
      setIsLandscape(window.matchMedia("(orientation: landscape)").matches);
    };
    syncMobile();
    window.addEventListener("resize", syncMobile);
    return () => window.removeEventListener("resize", syncMobile);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    setVolume(1);
    // Don't persist mobile-forced volume — desktop keeps its own preference
  }, [isMobile, setVolume]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedVolume = Number(localStorage.getItem("player:volume"));
    if (Number.isNaN(savedVolume)) {
      setVolume(0.5);
      localStorage.setItem("player:volume", "0.5");
    } else if (savedVolume >= 0 && savedVolume <= 1) {
      setVolume(savedVolume);
    }
    const raw = localStorage.getItem("player:state");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed?.albumId || !parsed?.songId) return;
      getPlayListInfoById(parsed.albumId).then((data) => {
        const song = data.songs.find((s) => s.id === parsed.songId) || data.songs[0];
        if (!song) return;
        setCurrentMusic({
          songs: data.songs.map(normalizeSongMediaType),
          playlist: data.playlist,
          song: normalizeSongMediaType(song)
        });
        setIsPlaying(true);
        setTimeout(() => {
          const media = getMediaElement(song);
          if (media && parsed.time) {
            media.currentTime = Number(parsed.time) || 0;
          }
        }, 100);
      });
    } catch (_) {}
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const media = getMediaElement();
      if (!media) return;
      setMobileTime(media.currentTime || 0);
    }, 250);
    return () => window.clearInterval(id);
  }, [currentMusic, isPlaying]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const keys = ["auth:user", "user", "username", "session:user", "player:user"];
    for (const k of keys) {
      const value = localStorage.getItem(k);
      if (value && value.trim()) {
        setPlayerUserId(value.trim());
        return;
      }
    }
    setPlayerUserId(null);
  }, []);

  useEffect(() => {
    if (!currentMusic.song) {
      return;
    }
    const media = getMediaElement();
    if (!media) return;
    isPlaying ? play() : media.pause();
  }, [isPlaying])

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
    if (videoRef.current) videoRef.current.volume = volume;
    setPersistedState({ volume });
  }, [volume])

  useEffect(() => {
    const {song} = currentMusic;
    if (!song) return;

    // Guard: same URL already loaded — Astro re-hydration or duplicate setCurrentMusic call.
    // Skip to avoid resetting the audio element and interrupting playback.
    if (song.url === prevSongUrlRef.current) return;

    // Build playback history for "previous" navigation.
    if (prevSongRef.current?.url && prevSongRef.current.url !== song.url) {
      if (isGoingBackRef.current) {
        isGoingBackRef.current = false;
      } else {
        playHistoryRef.current.push(prevSongRef.current);
        if (playHistoryRef.current.length > 200) {
          playHistoryRef.current.splice(0, playHistoryRef.current.length - 200);
        }
      }
    }

    // Save previous song to history
    if (prevSongDataRef.current) {
      try {
        const histRaw = localStorage.getItem('player:history');
        const hist = histRaw ? JSON.parse(histRaw) : [];
        hist.push({ ...prevSongDataRef.current, percent: maxListenedPercentRef.current, listenedAt: Date.now() });
        if (hist.length > 100) hist.splice(0, hist.length - 100);
        localStorage.setItem('player:history', JSON.stringify(hist));
      } catch {}
    }
    maxListenedPercentRef.current = 0;

    // Update recent albums and listened songs
    if (currentMusic.playlist?.albumId) {
      try {
        const recentRaw = localStorage.getItem('player:recentAlbums');
        const recent = recentRaw ? JSON.parse(recentRaw) : [];
        const existingIdx = recent.findIndex((r) => r.albumId === currentMusic.playlist.albumId);
        const existing = existingIdx >= 0 ? recent[existingIdx] : null;
        const listenedSongUrls = Array.from(new Set([...(existing?.listenedSongUrls ?? []), song.url]));
        const entry = {
          id: currentMusic.playlist.id,
          albumId: currentMusic.playlist.albumId,
          title: currentMusic.playlist.title,
          cover: currentMusic.playlist.cover,
          artists: currentMusic.playlist.artists,
          listenedSongUrls,
          totalSongs: currentMusic.songs.length,
          openedAt: Date.now(),
        };
        if (existingIdx >= 0) recent.splice(existingIdx, 1);
        recent.unshift(entry);
        if (recent.length > 10) recent.splice(10);
        localStorage.setItem('player:recentAlbums', JSON.stringify(recent));
        window.dispatchEvent(new CustomEvent('player:recentAlbumsUpdated'));
      } catch {}
    }

    // Track current song data for next history entry
    prevSongDataRef.current = {
      url: song.url,
      title: song.title,
      album: song.album ?? currentMusic.playlist?.title ?? '',
      artist: (song.artists ?? []).join(', '),
      image: song.image ?? '',
    };

    prevSongRef.current = song;
    prevSongUrlRef.current = song.url;

    // Track listened albums in localStorage
    if (currentMusic.playlist?.albumId) {
      try {
        const _raw = localStorage.getItem('player:listenedAlbums');
        const _ids = new Set(_raw ? JSON.parse(_raw) : []);
        _ids.add(currentMusic.playlist.albumId);
        localStorage.setItem('player:listenedAlbums', JSON.stringify([..._ids]));
        window.dispatchEvent(new CustomEvent('player:listenedAlbumsUpdated'));
      } catch {}
    }

    setIsLoading(true);
    setTrackLoading(true);
    setShowVideoModal(song.mediaType === "video");

    // Always stop both elements first to avoid overlapping playback
    if (audioRef.current) {
      audioRef.current.pause();
    }
    if (videoRef.current) {
      videoRef.current.pause();
    }

    const media = getMediaElement(song);
    if (!media) return;
    media.src = song.url;
    media.volume = volume;
    const raw = typeof window !== "undefined" ? localStorage.getItem("player:state") : null;
    let timeToSet = 0;
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed?.url === song.url && parsed?.time) {
          timeToSet = Number(parsed.time) || 0;
        }
      } catch (_) {}
    }
    media.currentTime = timeToSet;
    setPersistedState();
    play();
  }, [currentMusic])

  // When the active album changes, tell the SW to cache only its cover + all its audio files.
  // Guard: skip if same album already requested this session (avoids duplicate on React re-hydration).
  // The SW also has an early-exit if all files are already cached, so reloads are safe.
  useEffect(() => {
    const albumId = currentMusic.playlist?.albumId;
    if (!albumId || !('serviceWorker' in navigator)) return;
    if (lastCachedAlbumIdRef.current === albumId) return;
    lastCachedAlbumIdRef.current = albumId;
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    const audioUrls = (currentMusic.songs ?? [])
      .map(s => s.url)
      .filter(url => url && !String(url).toLowerCase().endsWith('.mp4'));
    const coverUrl = currentMusic.playlist.cover ?? null;
    const base = import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/';
    const playlistUrl = `${base}playlist/${currentMusic.playlist.id}/`;
    localStorage.setItem('sw:cachedPlaylistId', currentMusic.playlist.id);
    localStorage.setItem('sw:cachedPlaylistUrl', playlistUrl);
    controller.postMessage({ type: 'SET_ALBUM_CACHE', audioUrls, coverUrl, playlistUrl });
  }, [currentMusic.playlist?.albumId]);

  // Queue as virtual album: cache queue songs when added; revert to album when queue empties.
  // Only triggers on new additions — shifts (song played) are intentionally ignored.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;

    if (queue.length === 0) {
      if (lastQueueSigRef.current === '') return;
      lastQueueSigRef.current = '';
      // Queue emptied — clear SW queue cache (SW will evict removed files)
      controller.postMessage({ type: 'SET_QUEUE_CACHE', audioUrls: [] });
      return;
    }

    // Only send SET_QUEUE_CACHE when new songs are added (not when shifted out)
    const prevSet = new Set(lastQueueSigRef.current ? lastQueueSigRef.current.split('|') : []);
    const hasNewSongs = queue.some(s => s.url && !prevSet.has(s.url));
    if (!hasNewSongs) return;

    lastQueueSigRef.current = queue.map(s => s.url).join('|');
    const audioUrls = queue
      .map(s => s.url)
      .filter(url => url && !String(url).toLowerCase().endsWith('.mp4'));
    if (audioUrls.length > 0)
      controller.postMessage({ type: 'SET_QUEUE_CACHE', audioUrls });
  }, [queue]); // currentMusic intentionally omitted — stale value is acceptable here

  // Listen for cache progress reports from the SW
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const handler = (event) => {
      const { data } = event;
      if (data?.type === 'CACHE_CANCELLED') {
        clearTimeout(dismissTimerRef.current);
        setCacheProgress(null);
        return;
      }
      if (data?.type !== 'CACHE_PROGRESS') return;
      const { done, total } = data;
      if (total === 0) return;
      setCacheProgress({ done, total });
      clearTimeout(dismissTimerRef.current);
      if (done >= total) {
        dismissTimerRef.current = setTimeout(() => setCacheProgress(null), 2000);
      }
    };
    navigator.serviceWorker.addEventListener('message', handler);
    return () => {
      navigator.serviceWorker.removeEventListener('message', handler);
      clearTimeout(dismissTimerRef.current);
    };
  }, []);

  const play = () => {
    const media = getMediaElement();
    if (!media) return;
    media.play()
      .then(() => { setIsLoading(false); setTrackLoading(false); })
      .catch((e) => {
        setIsLoading(false);
        setTrackLoading(false);
        if (e?.name !== "NotAllowedError" && e?.name !== "AbortError") {
          console.log("error playing: ", e);
        }
      })
  }

  function onNextSong() {
    const queuedSong = shiftQueue();
    if (queuedSong) {
      setCurrentMusic({...currentMusic, song: normalizeSongMediaType(queuedSong)});
      return;
    }
    if (shuffleMode && currentMusic.songs.length > 1) {
      const currentUrl = currentMusic.song?.url;
      const candidates = currentMusic.songs.filter(s => s.url !== currentUrl);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      if (pick) {
        setCurrentMusic({...currentMusic, song: normalizeSongMediaType(pick)});
        return;
      }
    }
    const nextSong = getNextSong();
    if (nextSong) {
      setCurrentMusic({...currentMusic, song: normalizeSongMediaType(nextSong)});
      return;
    }
    if (repeatAllMode && currentMusic.songs.length > 0) {
      setCurrentMusic({...currentMusic, song: normalizeSongMediaType(currentMusic.songs[0])});
    }
  }

  function onPrevSongFromHistory() {
    const currentUrl = currentMusic.song?.url;
    while (playHistoryRef.current.length > 0) {
      const prev = playHistoryRef.current.pop();
      if (!prev?.url || prev.url === currentUrl) continue;
      isGoingBackRef.current = true;
      setCurrentMusic({ ...currentMusic, song: normalizeSongMediaType(prev) });
      return;
    }
  }

  const seekBy = (deltaSeconds) => {
    const media = getMediaElement();
    if (!media) return;
    const duration = Number.isFinite(media.duration) ? media.duration : 0;
    const next = Math.max(0, Math.min((media.currentTime || 0) + deltaSeconds, duration || Number.MAX_SAFE_INTEGER));
    media.currentTime = next;
    setPersistedState({ time: next });
  };

  const formatTime = (time) => {
    if (time == null || Number.isNaN(time)) return "0:00";
    const seconds = Math.floor(time % 60);
    const minutes = Math.floor(time / 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  useEffect(() => {
    if (!draggingSplit) return;
    const onMove = (event) => {
      if (!splitRef.current) return;
      const rect = splitRef.current.getBoundingClientRect();
      const clientX = event.touches?.[0]?.clientX ?? event.clientX;
      const pct = ((clientX - rect.left) / rect.width) * 100;
      const clamped = Math.min(85, Math.max(30, pct));
      setSplitPct(clamped);
    };
    const onUp = () => setDraggingSplit(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [draggingSplit]);

  useEffect(() => {
    setVideoPan({ x: 0, y: 0 });
  }, [currentMusic.song?.url, videoAspectIndex, fitVideo]);

  return (<>
    {cacheProgress && cacheProgress.total > 0 && (
      <div className="fixed top-0 left-0 right-0 z-[1999] bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-700 px-4 py-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-300 max-w-lg mx-auto">
          <span className="shrink-0 text-zinc-400">Caché</span>
          <div className="flex-1 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-500"
              style={{ width: `${Math.round((cacheProgress.done / cacheProgress.total) * 100)}%` }}
            />
          </div>
          <span className="shrink-0 tabular-nums text-zinc-300">{cacheProgress.done}/{cacheProgress.total}</span>
          {cacheProgress.done >= cacheProgress.total
            ? <span className="shrink-0 text-green-400 text-[11px]">✓</span>
            : (
              <button
                type="button"
                className="shrink-0 w-4 h-4 rounded-full bg-zinc-700 hover:bg-red-800 flex items-center justify-center text-zinc-400 hover:text-white transition-colors"
                title="Parar descarga"
                onClick={() => {
                  if ('serviceWorker' in navigator) {
                    const msg = { type: 'STOP_CACHE' };
                    if (navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage(msg);
                    } else {
                      navigator.serviceWorker.getRegistration('/_audios/').then(reg => {
                        reg?.active?.postMessage(msg);
                      }).catch(() => {});
                    }
                  }
                  lastCachedAlbumIdRef.current = null;
                  clearTimeout(dismissTimerRef.current);
                  setCacheProgress(null);
                }}
              >
                <span style={{ fontSize: '8px', lineHeight: 1 }}>✕</span>
              </button>
            )
          }
        </div>
      </div>
    )}
    {(isLoading || isTrackLoading) && (
      <div className="fixed inset-0 z-[1000] grid place-content-center bg-black/60">
        <div className="h-24 w-24 rounded-full border-8 border-zinc-700 border-t-green-500 animate-spin"></div>
      </div>
    )}
    {currentMusic.song?.mediaType === "video" && (
      <div className={`${showVideoModal ? "fixed inset-x-0 top-0 bottom-[72px] z-40" : "hidden"} bg-black/80 grid place-content-center p-6`}>
        <div ref={splitRef} className="w-[min(96vw,1400px)] h-full min-h-0 flex flex-col">
          <div className="flex justify-end mb-2">
            <button className="bg-zinc-800 hover:bg-zinc-700 px-3 py-1 rounded" onClick={() => setShowVideoModal(false)}>Cerrar</button>
          </div>
          <div className="flex-1 min-h-0 flex rounded overflow-hidden border border-zinc-700">
            <div className="relative min-w-0 min-h-0 bg-black/90" style={{ width: isChessVideoContext && showChessPanel && (!isMobile || isLandscape) ? `${splitPct}%` : "100%" }}>
              {isChessVideoContext && (!isMobile || isLandscape) && (
                <div className="absolute top-2 left-2 z-20 flex flex-col gap-2">
                  <button
                    className="h-9 w-9 rounded-full bg-zinc-900/80 hover:bg-zinc-700 text-[10px] border border-zinc-600"
                    title="Cambiar relación de aspecto del video"
                    onClick={() => {
                      setFitVideo(false);
                      setVideoAspectIndex((v) => (v + 1) % aspectModes.length);
                    }}
                  >
                    {currentAspect.label}
                  </button>
                  <button
                    className="h-9 w-9 rounded-full bg-zinc-900/80 hover:bg-zinc-700 text-xs border border-zinc-600"
                    title="Mostrar/ocultar tablero"
                    onClick={() => setShowChessPanel((v) => !v)}
                  >
                    {showChessPanel ? "♟" : "✕"}
                  </button>
                </div>
              )}
              <div className="w-full h-full overflow-hidden">
                <div style={fitVideo ? { width: "100%", height: "100%" } : { aspectRatio: currentAspect.ratio, width: "100%", height: "100%" }}>
                  <video
                    ref={videoRef}
                    className="bg-black rounded-none"
                    style={{
                      width: fitVideo ? "100%" : `${currentAspect.scale * 100}%`,
                      height: fitVideo ? "100%" : `${currentAspect.scale * 100}%`,
                      transform: `translate(${videoPan.x}px, ${videoPan.y}px)`,
                      transformOrigin: "top left",
                      objectFit: "contain",
                      objectPosition: fitVideo ? "center center" : currentAspect.anchor,
                    }}
                    controls
                    onEnded={onNextSong}
                    onCanPlay={() => { setIsLoading(false); setTrackLoading(false); }}
                    onWaiting={() => { setIsLoading(true); setTrackLoading(true); }}
                    onTimeUpdate={() => setPersistedState()}
                  />
                </div>
              </div>
              {!fitVideo && (
                <div className="absolute right-2 bottom-2 z-20 grid grid-cols-3 gap-1 bg-zinc-900/70 rounded-md p-1 border border-zinc-600">
                  <div />
                  <button className="h-7 w-7 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" onClick={() => setVideoPan((v) => ({ ...v, y: v.y - 28 }))} title="Mover arriba">↑</button>
                  <div />
                  <button className="h-7 w-7 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" onClick={() => setVideoPan((v) => ({ ...v, x: v.x + 28 }))} title="Mover izquierda">←</button>
                  <button className="h-7 w-7 rounded bg-zinc-800 hover:bg-zinc-700 text-[10px]" onClick={() => setVideoPan({ x: 0, y: 0 })} title="Centrar">•</button>
                  <button className="h-7 w-7 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" onClick={() => setVideoPan((v) => ({ ...v, x: v.x - 28 }))} title="Mover derecha">→</button>
                  <div />
                  <button className="h-7 w-7 rounded bg-zinc-800 hover:bg-zinc-700 text-xs" onClick={() => setVideoPan((v) => ({ ...v, y: v.y + 28 }))} title="Mover abajo">↓</button>
                  <div />
                </div>
              )}
            </div>
            {isChessVideoContext && showChessPanel && (!isMobile || isLandscape) && (
              <>
                <div
                  role="separator"
                  aria-orientation="vertical"
                  className="w-2 cursor-col-resize bg-zinc-700 hover:bg-green-600 active:bg-green-500"
                  onMouseDown={() => setDraggingSplit(true)}
                  onTouchStart={() => setDraggingSplit(true)}
                  title="Arrastra para cambiar tamaño entre video y visor"
                />
                <div className="min-w-0 min-h-0 flex-1 bg-zinc-950">
                  <ChessVideoAnalyzer
                    contextKey={currentMusic.song?.url || currentMusic.song?.id?.toString() || "default"}
                    userId={playerUserId}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    )}
    {isMobile && showAlbumModal && currentMusic.playlist && currentMusic.songs.length > 0 && (
      <div className="fixed inset-x-0 top-0 z-[48] bg-zinc-950 overflow-y-auto" style={{ bottom: '128px' }}>
        <div className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm px-4 py-3 flex items-center gap-3 border-b border-zinc-800">
          <button type="button" className="text-zinc-400 hover:text-white text-lg leading-none" onClick={() => setShowAlbumModal(false)} aria-label="Cerrar">✕</button>
          <h3 className="text-sm font-semibold truncate flex-1 text-zinc-100">{currentMusic.playlist.title}</h3>
        </div>
        <div className="flex items-center gap-4 px-4 py-4 border-b border-zinc-900">
          <img src={currentMusic.playlist.cover} alt={currentMusic.playlist.title} className="w-20 h-20 rounded-md object-cover shadow-lg shrink-0" />
          <div className="min-w-0">
            <h2 className="text-base font-bold text-white truncate">{currentMusic.playlist.title}</h2>
            <p className="text-xs text-zinc-400 truncate mt-0.5">{currentMusic.playlist.artists?.join(', ')}</p>
            <p className="text-xs text-zinc-600 mt-1">{currentMusic.songs.length} pistas</p>
          </div>
        </div>
        <div className="pb-2">
          {currentMusic.songs.map((song, idx) => {
            const isCurrent = song.url === currentMusic.song?.url;
            return (
              <button
                key={song.url}
                type="button"
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${isCurrent ? 'bg-zinc-800' : 'active:bg-zinc-900'}`}
                onClick={() => {
                  setCurrentMusic({ ...currentMusic, song: normalizeSongMediaType(song) });
                  setIsPlaying(true);
                  setShowAlbumModal(false);
                }}
              >
                <span className="text-xs text-zinc-600 w-4 shrink-0 text-right">{idx + 1}</span>
                <div className="relative shrink-0">
                  <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover" />
                  {isCurrent && (
                    <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center">
                      <span className="text-green-400 text-sm">{isPlaying ? '▶' : '⏸'}</span>
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className={`text-sm truncate ${isCurrent ? 'text-green-400 font-medium' : 'text-zinc-200'}`}>{song.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{song.artists?.join(', ')}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    )}
    <div className="relative grid grid-cols-1 md:grid-cols-[minmax(0,280px)_1fr_auto] items-center w-full px-2 gap-1 md:gap-4 z-50 h-full">
      {isMobile && (
        <div className="w-full px-1">
          <div className="absolute left-0 right-0 bottom-0 px-2">
            <Slider
              value={[safeMobileTime]}
              max={mobileDuration || Math.max(safeMobileTime, 1)}
              min={0}
              step={0.1}
              className="w-full"
              onValueChange={(value) => {
                const media = getMediaElement();
                if (!media) return;
                const [nextTime] = value;
                if (!Number.isFinite(nextTime)) return;
                media.currentTime = nextTime;
                setMobileTime(nextTime);
                setPersistedState({ time: nextTime });
              }}
            />
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              type="button"
              className="shrink-0"
              onClick={() => { if (currentMusic.songs.length > 0) setShowAlbumModal(v => !v); }}
              aria-label={showAlbumModal ? "Cerrar lista del álbum" : "Ver lista del álbum"}
            >
              <img
                src={currentMusic.song?.image || "/_audios/player/default-cover.svg"}
                alt={currentMusic.song?.title || "cover"}
                className={`w-10 h-10 rounded object-cover ${showAlbumModal ? 'ring-2 ring-green-400' : ''}`}
              />
            </button>
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="mobile-marquee text-xs text-green-300 font-bold whitespace-nowrap">
                {(currentMusic.song?.title || "Sin reproducción")} · {(currentMusic.song?.artists?.join(", ") || "Sin autor")}
              </div>
              <div className="text-[10px] text-zinc-500">
                {formatTime(safeMobileTime)} / {formatTime(mobileDuration)}
              </div>
            </div>
            <button
              className="w-7 h-7 rounded-full bg-zinc-700 text-white grid place-content-center shrink-0 text-[10px]"
              onClick={() => seekBy(-5)}
              title="Retroceder 5 segundos"
            >
              -5
            </button>
            <button
              className="relative w-10 h-10 rounded overflow-hidden shrink-0"
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? "Pausar" : "Reproducir"}
            >
              <img
                src={currentMusic.song?.image || "/_audios/player/default-cover.svg"}
                alt={currentMusic.song?.title || "cover"}
                className="w-full h-full object-cover"
              />
              <span className="absolute inset-0 bg-black/45 text-white grid place-content-center text-xl font-bold">
                {isPlaying ? "❚❚" : "▶"}
              </span>
            </button>
            <button
              className="w-7 h-7 rounded-full bg-zinc-700 text-white grid place-content-center shrink-0 text-[10px]"
              onClick={() => seekBy(5)}
              title="Adelantar 5 segundos"
            >
              +5
            </button>
          </div>
        </div>
      )}
      <div className="min-w-0 hidden md:block">
        <PlayerCurrentSong
          {...currentMusic.song}
          playlistPath={currentMusic.playlist?.id
            ? `${import.meta.env.BASE_URL.endsWith('/') ? import.meta.env.BASE_URL : import.meta.env.BASE_URL + '/'}playlist/${currentMusic.playlist.id}/`
            : null}
        />
      </div>

      <div className="hidden md:flex md:items-center md:justify-center gap-4 min-w-0 overflow-hidden">
        <div className="flex justify-center flex-col items-center w-full">
          <PlayerControlButtonBar onSeekBack={() => seekBy(-5)} onSeekForward={() => seekBy(5)} onNextSong={onNextSong} onPrevSong={onPrevSongFromHistory} />
          <PlayerSoundControl audio={getMediaRef()}/>
        </div>
      </div>

      <div className="hidden md:grid place-content-center justify-self-end">
        <PlayerVolumeControl/>
      </div>
    </div>
    <audio ref={audioRef}
           onEnded={onNextSong}
           onCanPlay={() => { setIsLoading(false); setTrackLoading(false); }}
           onWaiting={() => { setIsLoading(true); setTrackLoading(true); }}
           onTimeUpdate={() => setPersistedState()}
           className="hidden"
    />
  </>)
}
