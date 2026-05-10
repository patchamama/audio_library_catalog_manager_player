import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Playlist, Song } from "@/lib/types";
import { usePlayerStore } from "@/store/playerStore";
import { normalizeSongMediaType } from "@/lib/media";
import { fetchSearch, fetchPlaylists, getPlaylistsFromSwCache, getCachedAlbumInfo } from "@/services/ApiService";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/categories";
import { probeConnectivity } from "@/components/OfflineBanner";

const CACHE_COVER = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="12" fill="#0f172a"/><path d="M60 110 A32 32 0 0 1 88 76 A42 42 0 0 1 156 104 A26 26 0 0 1 150 152 L60 152 A32 32 0 0 1 60 110Z" fill="none" stroke="#22c55e" stroke-width="7" stroke-linejoin="round"/><line x1="100" y1="102" x2="100" y2="145" stroke="#4ade80" stroke-width="7" stroke-linecap="round"/><polyline points="83,132 100,150 117,132" fill="none" stroke="#4ade80" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/><line x1="80" y1="158" x2="120" y2="158" stroke="#4ade80" stroke-width="5" stroke-linecap="round"/></svg>')}`;

interface RecentAlbum {
  id: string;
  albumId: number;
  title: string;
  cover: string;
  artists: string[];
  listenedSongUrls: string[];
  totalSongs: number;
  openedAt: number;
}

interface HistoryItem {
  url: string;
  title: string;
  album: string;
  artist: string;
  image: string;
  percent: number;
  listenedAt: number;
}

interface Props {
  baseUrl: string;
}

const normalizeForSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

const sameArtists = (a: string[], b: string[]) => {
  const left = a.map(normalizeForSearch).filter(Boolean).sort();
  const right = b.map(normalizeForSearch).filter(Boolean).sort();
  if (left.length !== right.length) return false;
  return left.every((v, i) => v === right[i]);
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Ahora';
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function fmtSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function CircleRing({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full pointer-events-none z-10"
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle cx="50" cy="50" r={r} fill="none" stroke="#3f3f46" strokeWidth="4" />
      <circle
        cx="50" cy="50" r={r} fill="none"
        stroke="#22c55e"
        strokeWidth="4"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0, Math.min(100, pct)) / 100)}
        strokeLinecap="round"
      />
    </svg>
  );
}

function albumMatchesCategory(haystack: string, cat: Category): boolean {
  return cat.terms.some(term => haystack.includes(normalizeForSearch(term)));
}

export function AlbumBrowser({ baseUrl }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [apiPage, setApiPage] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  const [backendSearch, setBackendSearch] = useState<{ query: string; playlists: Playlist[]; songs: Song[] } | null>(null);
  const [desktopSearchFetching, setDesktopSearchFetching] = useState(false);
  const [mobileSearchFetching, setMobileSearchFetching] = useState(false);

  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [noCacheOffline, setNoCacheOffline] = useState(false);

  // Load first page: offline → cache only; online → cache first then network
  useEffect(() => {
    getCachedAlbumInfo().then(setCachedAlbumInfo);

    const offline = typeof navigator !== 'undefined' && !navigator.onLine;

    if (offline) {
      getPlaylistsFromSwCache().then(cached => {
        if (cached && cached.playlists.length > 0) {
          setPlaylists(cached.playlists);
          setApiTotalPages(cached.totalPages);
        } else {
          setNoCacheOffline(true);
        }
        setLoadingPage(false);
      });
      return;
    }

    // Online: show SW cache immediately, then refresh from network
    getPlaylistsFromSwCache().then(cached => {
      if (cached && cached.playlists.length > 0) {
        setPlaylists(cached.playlists);
        setApiTotalPages(cached.totalPages);
      }
    });
    setLoadingPage(true);
    fetchPlaylists(1)
      .then(data => {
        setPlaylists(data.playlists);
        setApiPage(1);
        setApiTotalPages(data.totalPages);
        setLoadingPage(false);
      })
      .catch(() => setLoadingPage(false));

    fetch('/_audios/categories.json')
      .then(r => r.ok ? r.json() : null)
      .then((data: Category[] | null) => { if (Array.isArray(data) && data.length > 0) setCategories(data); })
      .catch(() => {});
  }, []);

  // When connection is restored: clear no-cache flag and reload data
  useEffect(() => {
    const handleOnline = () => {
      setNoCacheOffline(false);
      setLoadingPage(true);
      fetchPlaylists(1)
        .then(data => {
          setPlaylists(data.playlists);
          setApiPage(1);
          setApiTotalPages(data.totalPages);
          setLoadingPage(false);
        })
        .catch(() => setLoadingPage(false));
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const loadNextPage = useCallback(() => {
    if (loadingPage || apiPage >= apiTotalPages) return;
    setLoadingPage(true);
    fetchPlaylists(apiPage + 1)
      .then(data => {
        setPlaylists(prev => [...prev, ...data.playlists]);
        setApiPage(data.page);
        setApiTotalPages(data.totalPages);
        setLoadingPage(false);
      })
      .catch(() => setLoadingPage(false));
  }, [loadingPage, apiPage, apiTotalPages]);

  // ─── Search inputs / queries ─────────────────────────────────────────────
  const [albumInput, setAlbumInput] = useState("");
  const [contentInput, setContentInput] = useState("");
  const [mobileInput, setMobileInput] = useState("");
  const [albumQuery, setAlbumQuery] = useState("");
  const [mobileQuery, setMobileQuery] = useState("");

  // ─── UI state ────────────────────────────────────────────────────────────
  const [mobileSection, setMobileSection] = useState<"home" | "search" | "library" | "queue">("home");
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)').matches : false
  );
  const [navLoading, setNavLoading] = useState(false);
  const [mobileQueueTab, setMobileQueueTab] = useState<'queue' | 'cache'>('queue');
  const [showCacheView, setShowCacheView] = useState(false);
  const [showHistoryView, setShowHistoryView] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // ─── Persisted / localStorage state ─────────────────────────────────────
  const [listenedAlbumIds, setListenedAlbumIds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('player:listenedAlbums');
      return new Set(raw ? JSON.parse(raw) : []);
    } catch { return new Set(); }
  });
  const [cachedAlbumInfo, setCachedAlbumInfo] = useState<{ audioUrls: string[]; coverUrl: string | null; fileSizes: Record<string, number> }>({ audioUrls: [], coverUrl: null, fileSizes: {} });
  const [recentAlbums, setRecentAlbums] = useState<RecentAlbum[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('player:recentAlbums');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('player:history');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [fontScale, setFontScale] = useState<0|1|2|3>(() => {
    if (typeof window === 'undefined') return 0;
    return (Number(localStorage.getItem('font-scale') ?? 0) as 0|1|2|3);
  });

  // ─── Refs ────────────────────────────────────────────────────────────────
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const mobileSentinelRef = useRef<HTMLDivElement | null>(null);

  // ─── Store ───────────────────────────────────────────────────────────────
  const currentMusic = usePlayerStore(state => state.currentMusic);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const queue = usePlayerStore(state => state.queue);
  const setCurrentMusic = usePlayerStore(state => state.setCurrentMusic);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const addToQueue = usePlayerStore(state => state.addToQueue);
  const removeFromQueue = usePlayerStore(state => state.removeFromQueue);
  const clearQueue = usePlayerStore(state => state.clearQueue);
  const setMobilePlayerVisible = usePlayerStore(state => state.setMobilePlayerVisible);
  const queueSet = useMemo(() => new Set(queue.map((q) => `${q.albumId}-${q.id}-${q.url}`)), [queue]);

  const pendingDesktopSearch = albumInput !== albumQuery;
  const pendingMobileSearch = mobileInput !== mobileQuery;
  const showDesktopSearchSpinner = !!albumInput.trim() && (pendingDesktopSearch || desktopSearchFetching);
  const showMobileSearchSpinner = !!mobileInput.trim() && (pendingMobileSearch || mobileSearchFetching);

  // ─── Backend search (mobile) ─────────────────────────────────────────────
  useEffect(() => {
    if (!mobileQuery.trim()) { setBackendSearch(null); setMobileSearchFetching(false); return; }
    setMobileSearchFetching(true);
    fetchSearch(mobileQuery)
      .then(data => {
        setBackendSearch({ query: mobileQuery, playlists: data.playlists, songs: data.songs });
        setMobileSearchFetching(false);
      })
      .catch(() => setMobileSearchFetching(false));
  }, [mobileQuery]);

  // ─── Backend search (desktop) ────────────────────────────────────────────
  useEffect(() => {
    if (!albumQuery.trim()) { setBackendSearch(null); setDesktopSearchFetching(false); return; }
    setDesktopSearchFetching(true);
    fetchSearch(albumQuery)
      .then(data => {
        setBackendSearch({ query: albumQuery, playlists: data.playlists, songs: data.songs });
        setDesktopSearchFetching(false);
      })
      .catch(() => setDesktopSearchFetching(false));
  }, [albumQuery]);

  // ─── URL ?filter= param ──────────────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const filter = params.get('filter');
    if (!filter?.trim()) return;
    setAlbumInput(filter);
    setAlbumQuery(filter);
    setContentInput(filter);
    if (window.matchMedia('(max-width: 767px)').matches) {
      setMobileInput(filter);
      setMobileQuery(filter);
      setMobileSection('search');
    }
  }, []);

  // ─── Debounced queries ───────────────────────────────────────────────────
  useEffect(() => {
    const id = window.setTimeout(() => setAlbumQuery(albumInput), 2000);
    return () => window.clearTimeout(id);
  }, [albumInput]);

  useEffect(() => {
    const id = window.setTimeout(() => setMobileQuery(mobileInput), 2000);
    return () => window.clearTimeout(id);
  }, [mobileInput]);

  // ─── Tokenized search terms ──────────────────────────────────────────────
  const desktopTokens = useMemo(
    () => normalizeForSearch(albumQuery).split(/\s+/).filter(Boolean),
    [albumQuery]
  );
  const mobileTokens = useMemo(
    () => normalizeForSearch(mobileQuery).split(/\s+/).filter(Boolean),
    [mobileQuery]
  );
  const hasTextSearch = desktopTokens.length > 0;

  // ─── Category-filtered playlists (base for all album views) ─────────────
  const categoryFilteredPlaylists = useMemo(() => {
    if (!selectedCategory) return playlists;
    const cat = categories.find(c => c.id === selectedCategory);
    if (!cat) return playlists;
    return playlists.filter(p => {
      const haystack = normalizeForSearch(
        p.title + ' ' + (p.artists || []).join(' ') + ' ' + (p.folderName || '')
      );
      return albumMatchesCategory(haystack, cat);
    });
  }, [playlists, selectedCategory, categories]);

  // ─── Desktop: albums from backend search (fallback: local filter on loaded pages) ──
  const filteredAlbums = useMemo(() => {
    if (desktopTokens.length === 0) return categoryFilteredPlaylists;
    const source = (backendSearch && backendSearch.query === albumQuery)
      ? backendSearch.playlists as Playlist[]
      : categoryFilteredPlaylists;
    if (!selectedCategory) return source;
    const cat = categories.find(c => c.id === selectedCategory);
    if (!cat) return source;
    return source.filter(p => {
      const haystack = normalizeForSearch(p.title + ' ' + (p.artists || []).join(' ') + ' ' + (p.folderName || ''));
      return albumMatchesCategory(haystack, cat);
    });
  }, [categoryFilteredPlaylists, desktopTokens, backendSearch, albumQuery, selectedCategory, categories]);

  // ─── Desktop: songs from backend search results ───────────────────────────
  const filteredSongs = useMemo(() => {
    if (desktopTokens.length === 0 || !backendSearch || backendSearch.query !== albumQuery) return [];
    const albumById = new Map<number, Playlist>();
    [...playlists, ...(backendSearch.playlists as Playlist[])].forEach(p => albumById.set(p.albumId, p));
    return (backendSearch.songs as Song[])
      .map(s => ({ song: s, album: albumById.get(s.albumId) }))
      .filter((x): x is { song: Song; album: Playlist } => !!x.album);
  }, [desktopTokens, backendSearch, albumQuery, playlists]);

  // ─── Recent albums (category-filtered, for home view) ───────────────────
  const recentAlbumIdSet = useMemo(() => new Set(recentAlbums.map(r => r.albumId)), [recentAlbums]);

  const recentFilteredAlbums = useMemo(() => {
    let list = recentAlbums;
    if (selectedCategory) {
      const cat = categories.find(c => c.id === selectedCategory);
      if (cat) {
        list = list.filter(r => {
          const haystack = normalizeForSearch(r.title + ' ' + r.artists.join(' '));
          return albumMatchesCategory(haystack, cat);
        });
      }
    }
    return list.slice(0, 10);
  }, [recentAlbums, selectedCategory, categories]);

  // ─── Other albums: category-filtered, non-recent ─────────────────────────
  const homeOtherAlbums = useMemo(() =>
    categoryFilteredPlaylists.filter(p => !recentAlbumIdSet.has(p.albumId)),
    [categoryFilteredPlaylists, recentAlbumIdSet]
  );

  // ─── Mobile search: albums from backend (fallback: local filter on loaded pages) ──
  const mobileSearchAlbums = useMemo(() => {
    if (mobileTokens.length === 0) return playlists.slice(0, 120);
    if (backendSearch && backendSearch.query === mobileQuery) return backendSearch.playlists as Playlist[];
    return playlists.filter(p => {
      const haystack = normalizeForSearch(
        p.title + ' ' + (p.artists || []).join(' ') + ' ' + (p.folderName || '')
      );
      return mobileTokens.every(t => haystack.includes(t));
    });
  }, [playlists, mobileTokens, backendSearch, mobileQuery]);

  const mobileSearchSongs = useMemo(() => {
    if (mobileTokens.length === 0 || !backendSearch || backendSearch.query !== mobileQuery) return [];
    const byId = new Map<number, Playlist>();
    [...playlists, ...(backendSearch.playlists as Playlist[])].forEach(p => byId.set(p.albumId, p));
    return (backendSearch.songs as Song[])
      .map(s => ({ song: s, album: byId.get(s.albumId) }))
      .filter((x): x is { song: Song; album: Playlist } => !!x.album);
  }, [backendSearch, mobileQuery, mobileTokens, playlists]);

  // ─── Cached audio files view ─────────────────────────────────────────────
  const cachedSongsForView: Song[] = useMemo(() => {
    const { audioUrls, coverUrl } = cachedAlbumInfo;
    const sortedUrls = [...audioUrls].sort((a, b) => {
      const fa = decodeURIComponent(a.split('/').pop() ?? a);
      const fb = decodeURIComponent(b.split('/').pop() ?? b);
      return fa.localeCompare(fb, 'es', { numeric: true, sensitivity: 'base' });
    });
    return sortedUrls.map((url, idx) => {
      const known = currentMusic.songs.find(s => s.url === url);
      if (known) return known;
      const decoded = decodeURIComponent(url);
      const segments = decoded.split('/').filter(Boolean);
      const filename = segments[segments.length - 1] ?? '';
      const folder = segments[segments.length - 2] ?? '';
      const title = filename.replace(/\.(mp3|ogg|m4a|webm|mp4)$/i, '').trim() || filename;
      const dashIdx = folder.indexOf(' - ');
      const artist = dashIdx > 0 ? folder.slice(0, dashIdx).trim() : 'Desconocido';
      const albumTitle = dashIdx > 0 ? folder.slice(dashIdx + 3).trim() : folder;
      return {
        id: idx, albumId: 0, title,
        artists: [artist], album: albumTitle,
        image: coverUrl ?? '', duration: '', url, mediaType: 'audio' as const,
      } as Song;
    });
  }, [cachedAlbumInfo, currentMusic.songs]);

  const moreToLoad = apiPage < apiTotalPages;

  // ─── Lifecycle effects ───────────────────────────────────────────────────
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
      if (href.includes("/playlist/")) setMobilePlayerVisible(true);
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
        // Probe connectivity — if online event fires, handleOnline will reload data
        if (section === "home" || section === "library") probeConnectivity();
      }
    };
    document.addEventListener("mobile-nav-select", onMobileSelect);
    return () => document.removeEventListener("mobile-nav-select", onMobileSelect);
  }, []);

  // Desktop sentinel
  useEffect(() => {
    if (!sentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      loadNextPage();
    }, { root: null, threshold: 0 });
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadNextPage]);

  // Mobile sentinel — re-runs when section or loadNextPage changes
  useEffect(() => {
    if (!mobileSentinelRef.current) return;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      loadNextPage();
    }, { root: null, threshold: 0 });
    observer.observe(mobileSentinelRef.current);
    return () => observer.disconnect();
  }, [loadNextPage, mobileSection]);

  useEffect(() => {
    if (!navLoading) return;
    const id = window.setTimeout(() => setNavLoading(false), 1400);
    return () => window.clearTimeout(id);
  }, [navLoading]);

  useEffect(() => {
    const handler = () => {
      try {
        const raw = localStorage.getItem('player:listenedAlbums');
        setListenedAlbumIds(new Set(raw ? JSON.parse(raw) : []));
      } catch {}
    };
    window.addEventListener('player:listenedAlbumsUpdated', handler as EventListener);
    return () => window.removeEventListener('player:listenedAlbumsUpdated', handler as EventListener);
  }, []);

  useEffect(() => {
    const handler = () => {
      try {
        const recentRaw = localStorage.getItem('player:recentAlbums');
        setRecentAlbums(recentRaw ? JSON.parse(recentRaw) : []);
        const histRaw = localStorage.getItem('player:history');
        setHistoryItems(histRaw ? JSON.parse(histRaw) : []);
      } catch {}
    };
    window.addEventListener('player:recentAlbumsUpdated', handler as EventListener);
    return () => window.removeEventListener('player:recentAlbumsUpdated', handler as EventListener);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
    const handler = () => getCachedAlbumInfo().then(setCachedAlbumInfo);
    navigator.serviceWorker.addEventListener('message', handler);
    return () => navigator.serviceWorker.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${16 + fontScale * 2}px`;
    document.documentElement.classList.toggle('font-scale-large', fontScale >= 2);
    localStorage.setItem('font-scale', String(fontScale));
  }, [fontScale]);

  // ─── Shared sub-elements ──────────────────────────────────────────────────
  const fontSizeControls = (
    <div className="flex items-center gap-0.5 shrink-0" title="Tamaño de fuente">
      {([0, 1, 2, 3] as const).map(level => (
        <button
          key={level}
          onClick={() => setFontScale(level)}
          className={`rounded px-1 py-0.5 font-bold leading-none transition-colors ${
            fontScale === level ? 'text-green-400' : 'text-zinc-500 hover:text-zinc-300'
          }`}
          style={{ fontSize: `${10 + level * 2}px` }}
          title={level === 0 ? 'Tamaño normal' : `+${level * 2}px`}
        >
          A
        </button>
      ))}
    </div>
  );

  const categoryPills = (
    <div
      className="flex gap-3 overflow-x-auto pb-2 mb-4"
      style={{ scrollSnapType: 'x mandatory' }}
    >
      {categories.map(cat => (
        <button
          key={cat.id}
          type="button"
          onClick={() => setSelectedCategory(selectedCategory === cat.id ? null : cat.id)}
          className="flex-none flex flex-col items-center gap-1"
          style={{ scrollSnapAlign: 'start' }}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center text-2xl transition-colors ${
            selectedCategory === cat.id
              ? 'bg-green-500 ring-2 ring-green-400'
              : 'bg-zinc-800 hover:bg-zinc-700'
          }`}>
            {cat.icon}
          </div>
          <span className={`text-[11px] font-semibold whitespace-nowrap ${
            selectedCategory === cat.id ? 'text-green-300' : 'text-white'
          }`}>{cat.label}</span>
        </button>
      ))}
    </div>
  );

  // ─── MOBILE RENDER ────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <section className="px-0 pt-4 pb-24 relative">
        {navLoading && (
          <div className="fixed inset-0 z-[1000] grid place-content-center bg-black/65">
            <div className="h-24 w-24 rounded-full border-8 border-zinc-700 border-t-green-500 animate-spin"></div>
          </div>
        )}

        {/* ── HOME ──────────────────────────────────────────────────── */}
        {mobileSection === "home" && (
          <div id="home" className="px-3">
            {showHistoryView ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button type="button" className="text-zinc-400 hover:text-white" onClick={() => setShowHistoryView(false)}>← Volver</button>
                  <h2 className="text-xl font-semibold">Historial</h2>
                </div>
                {historyItems.length === 0 && <p className="text-zinc-500 text-sm">Sin historial.</p>}
                <div className="space-y-1">
                  {[...historyItems].reverse().map((item, idx) => (
                    <div key={`${item.url}-${idx}`} className="flex items-center gap-3 px-2 py-2 rounded-lg">
                      <img src={item.image || CACHE_COVER} alt={item.title} className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-zinc-100 truncate">{item.title}</div>
                        <div className="text-xs text-zinc-500 truncate">{item.album}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500/70" style={{ width: `${item.percent}%` }} />
                          </div>
                          <span className="text-[10px] text-zinc-500 shrink-0">{item.percent}%</span>
                        </div>
                      </div>
                      <span className="text-[10px] text-zinc-600 shrink-0">{timeAgo(item.listenedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : showCacheView ? (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <button type="button" className="text-zinc-400 hover:text-white" onClick={() => setShowCacheView(false)}>← Volver</button>
                  <h2 className="text-xl font-semibold">Audios en caché</h2>
                </div>
                <div className="flex gap-3 items-center mb-5 p-3 rounded-xl bg-gradient-to-r from-green-950/60 to-zinc-900">
                  <img src={cachedAlbumInfo.coverUrl ?? CACHE_COVER} alt="Caché" className="w-20 h-20 rounded-lg object-cover shadow-lg shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Lista offline</p>
                    <h3 className="text-base font-bold text-white">Audios en caché</h3>
                    <p className="text-xs text-zinc-400 mt-0.5">{cachedSongsForView.length} archivos disponibles</p>
                    {cachedSongsForView.length > 0 && (
                      <button
                        type="button"
                        className="mt-2 bg-green-500 hover:bg-green-400 text-black text-xs font-bold px-3 py-1 rounded-full"
                        onClick={() => {
                          const s = cachedSongsForView.map(normalizeSongMediaType);
                          setCurrentMusic({ ...currentMusic, songs: s, song: s[0] });
                          setIsPlaying(true);
                          setMobilePlayerVisible(true);
                        }}
                      >
                        ▶ Reproducir todo
                      </button>
                    )}
                  </div>
                </div>
                {cachedSongsForView.length === 0 && <p className="text-zinc-500 text-sm">Sin audio en caché.</p>}
                <div className="space-y-1">
                  {cachedSongsForView.map((song, idx) => {
                    const isCurrent = currentMusic.song?.url === song.url;
                    const songImg = song.image || CACHE_COVER;
                    const size = cachedAlbumInfo.fileSizes[song.url];
                    return (
                      <button
                        key={song.url}
                        type="button"
                        className={`w-full flex items-center gap-3 px-2 py-2 rounded-lg text-left ${isCurrent ? 'bg-zinc-800' : 'active:bg-zinc-900'}`}
                        onClick={() => {
                          const s = cachedSongsForView.map(normalizeSongMediaType);
                          setCurrentMusic({ ...currentMusic, songs: s, song: normalizeSongMediaType(song) });
                          setIsPlaying(true);
                          setMobilePlayerVisible(true);
                        }}
                      >
                        <span className="text-xs text-zinc-600 w-5 shrink-0 text-right">{idx + 1}</span>
                        <img src={songImg} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm truncate ${isCurrent ? 'text-green-400 font-medium' : 'text-zinc-100'}`}>{song.title}</div>
                          {song.artists.length > 0 && <div className="text-xs text-zinc-500 truncate">{song.artists.join(', ')}</div>}
                        </div>
                        {size && <span className="text-[10px] text-zinc-600 shrink-0">{fmtSize(size)}</span>}
                        {isCurrent && <span className="text-green-400 text-xs shrink-0">●</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-semibold">Inicio</h2>
                    {historyItems.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-zinc-500 hover:text-zinc-300 px-2 py-0.5 rounded-full bg-zinc-800"
                        onClick={() => setShowHistoryView(true)}
                      >
                        Historial
                      </button>
                    )}
                  </div>
                  {fontSizeControls}
                </div>

                {/* Category pills */}
                {categoryPills}

                {loadingPage && playlists.length === 0 && (
                  <div className="flex justify-center py-12">
                    <div className="h-10 w-10 rounded-full border-4 border-zinc-700 border-t-green-500 animate-spin" />
                  </div>
                )}

                {noCacheOffline && playlists.length === 0 && !loadingPage && (
                  <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                    <span className="text-4xl opacity-60">📡</span>
                    <p className="text-zinc-300 font-medium">Sin conexión</p>
                    <p className="text-zinc-500 text-sm">No hay audios en caché.<br/>Conectate a internet una vez<br/>para cargar el catálogo.</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {/* Cache card — always first */}
                  <button
                    type="button"
                    className="rounded-lg bg-zinc-800/80 p-2.5 text-left"
                    onClick={() => setShowCacheView(true)}
                  >
                    <div className="relative">
                      <img src={cachedAlbumInfo.coverUrl ?? CACHE_COVER} alt="Caché" className="w-full aspect-square object-cover rounded-md scale-[0.96]" />
                      {cachedSongsForView.length > 0 && (
                        <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow z-10">
                          <span className="text-white text-[10px] font-bold leading-none">✓</span>
                        </div>
                      )}
                    </div>
                    <div className="mt-2 text-sm text-zinc-100 line-clamp-2">Audios en caché</div>
                    <div className="text-xs text-zinc-400 mt-0.5">
                      {cachedSongsForView.length > 0 ? `${cachedSongsForView.length} archivos` : 'Sin caché'}
                    </div>
                  </button>

                  {/* Recent albums — always show check icon + circle progress */}
                  {recentFilteredAlbums.map((recent) => {
                    const listenedPct = recent.totalSongs > 0
                      ? Math.round((recent.listenedSongUrls.length / recent.totalSongs) * 100)
                      : 0;
                    const isCurrentAlbum = currentMusic?.playlist?.albumId === recent.albumId;
                    return (
                      <a
                        key={`recent-${recent.id}`}
                        href={`${baseUrl}playlist/${recent.id}/`}
                        className="rounded-lg bg-zinc-800/80 p-2.5"
                        onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}
                      >
                        <div className="relative">
                          <CircleRing pct={listenedPct} />
                          <img
                            src={recent.cover}
                            alt={recent.title}
                            className="w-full aspect-square object-cover rounded-md scale-[0.88]"
                            loading="lazy"
                          />
                          {isCurrentAlbum && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-md" style={{background:'rgba(0,0,0,0.32)'}}>
                              <div className="w-10 h-10 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
                                <span className="text-white text-sm ml-0.5">{isPlaying ? '▶' : '⏸'}</span>
                              </div>
                            </div>
                          )}
                          {/* Always show check icon — album has been opened */}
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow z-20">
                            <span className="text-white text-[10px] font-bold leading-none">✓</span>
                          </div>
                        </div>
                        <div className="mt-2 text-sm text-zinc-100 line-clamp-2">{recent.title}</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{timeAgo(recent.openedAt)}</div>
                      </a>
                    );
                  })}

                  {/* Rest of library */}
                  {homeOtherAlbums.map((playlist) => {
                    const isCurrentAlbum = currentMusic?.playlist?.albumId === playlist.albumId;
                    return (
                      <a
                        key={playlist.id}
                        href={`${baseUrl}playlist/${playlist.id}/`}
                        className="rounded-lg bg-zinc-800/80 p-2.5"
                        onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}
                      >
                        <div className="relative">
                          <img
                            src={playlist.cover}
                            alt={playlist.title}
                            className="w-full aspect-square object-cover rounded-md scale-[0.96]"
                            loading="lazy"
                          />
                          {isCurrentAlbum && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-md" style={{background:'rgba(0,0,0,0.32)'}}>
                              <div className="w-10 h-10 rounded-full bg-green-500/90 flex items-center justify-center shadow-lg">
                                <span className="text-white text-sm ml-0.5">{isPlaying ? '▶' : '⏸'}</span>
                              </div>
                            </div>
                          )}
                          {listenedAlbumIds.has(playlist.albumId) && (
                            <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow z-10">
                              <span className="text-white text-[10px] font-bold leading-none">✓</span>
                            </div>
                          )}
                          {typeof playlist.songCount === 'number' && playlist.songCount > 0 && (
                            <div className="absolute bottom-1 left-1 bg-black/70 text-white text-[10px] font-bold rounded px-1 leading-tight z-10">
                              {playlist.songCount}
                            </div>
                          )}
                        </div>
                        <div className="mt-2 text-sm text-zinc-100 line-clamp-2">{playlist.title}</div>
                      </a>
                    );
                  })}
                </div>

                <div ref={mobileSentinelRef} className="py-4 text-center text-xs text-zinc-500">
                  {loadingPage ? "Cargando más..." : ""}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SEARCH ────────────────────────────────────────────────── */}
        {mobileSection === "search" && (
          <div id="search" className="px-[2px]">
            <h2 className="text-xl font-semibold mb-4">Buscar</h2>
            <input
              className="w-full bg-zinc-800 rounded-md px-3 py-2 text-sm outline-none mb-2"
              placeholder="Buscar álbumes o audios"
              value={mobileInput}
              onChange={(e) => setMobileInput(e.target.value)}
            />
            {showMobileSearchSpinner && (
              <div className="mt-1 mb-2 flex items-center gap-2 text-xs text-zinc-400">
                <div className="h-3 w-3 rounded-full border-2 border-zinc-600 border-t-green-500 animate-spin" />
                Buscando...
              </div>
            )}

            {/* Album results */}
            {mobileSearchAlbums.length > 0 && mobileTokens.length > 0 && (
              <p className="text-xs text-zinc-500 mb-2">{mobileSearchAlbums.length} álbumes</p>
            )}
            <div className="mt-2 space-y-2">
              {mobileSearchAlbums.map((playlist) => (
                <a
                  key={`a-${playlist.id}`}
                  href={`${baseUrl}playlist/${playlist.id}/`}
                  className="flex items-center gap-3 rounded-md bg-zinc-800/70 px-2 py-2"
                  onClick={() => { setNavLoading(true); setMobilePlayerVisible(true); }}
                >
                  <div className="relative w-10 h-10 shrink-0">
                    <img src={playlist.cover} alt={playlist.title} className="absolute left-0 top-0 w-8 h-8 rounded object-cover opacity-85" />
                    <img src={playlist.cover} alt={playlist.title} className="absolute left-2 top-2 w-8 h-8 rounded object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs text-zinc-400">Álbum</div>
                    <div className="text-sm text-zinc-100 truncate">{playlist.title}</div>
                    <div className="text-xs text-zinc-300 truncate">{playlist.artists.join(", ")}</div>
                  </div>
                </a>
              ))}

              {/* Song results — shown after albums */}
              {mobileSearchSongs.length > 0 && (
                <>
                  <p className="text-xs text-zinc-500 pt-2">{mobileSearchSongs.length} audios</p>
                  {mobileSearchSongs.map(({ song, album }) => (
                    <div key={`s-${song.url}`} className="flex items-center gap-2 rounded-md bg-zinc-800/70 px-2 py-2">
                      <a
                        href={`${baseUrl}playlist/${album.id}/`}
                        className="flex items-center gap-3 min-w-0 flex-1"
                        onClick={() => {
                          setNavLoading(true);
                          setMobilePlayerVisible(true);
                          if (typeof window === "undefined") return;
                          localStorage.setItem("player:state", JSON.stringify({
                            albumId: album.albumId, songId: song.id, url: song.url, time: 0,
                          }));
                          localStorage.setItem("player:activeAlbum", String(album.albumId));
                          localStorage.setItem("player:activeSong", String(song.id));
                        }}
                      >
                        <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                        <div className="min-w-0">
                          <div className="text-xs text-zinc-400">Audio</div>
                          <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                          <div className="text-xs text-zinc-300 truncate">{song.artists.join(", ")}</div>
                        </div>
                      </a>
                      <button
                        className="shrink-0 text-xs bg-zinc-700 hover:bg-zinc-600 rounded px-2 py-1"
                        onClick={() => addToQueue(normalizeSongMediaType(song))}
                        title="Agregar a cola"
                        type="button"
                      >
                        {queueSet.has(`${song.albumId}-${song.id}-${song.url}`) ? "✓" : "＋"}
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        )}

        {/* ── LIBRARY ───────────────────────────────────────────────── */}
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
              {moreToLoad && (
                <div ref={mobileSentinelRef} className="py-4 text-center text-xs text-zinc-500">
                  {loadingPage ? "Cargando más..." : ""}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── QUEUE ─────────────────────────────────────────────────── */}
        {mobileSection === "queue" && (
          <div id="queue" className="px-[2px]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMobileQueueTab('queue')}
                  className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${mobileQueueTab === 'queue' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Cola</button>
                <button
                  onClick={() => setMobileQueueTab('cache')}
                  className={`text-sm font-semibold px-3 py-1 rounded-full transition-colors ${mobileQueueTab === 'cache' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >Caché</button>
              </div>
              {mobileQueueTab === 'queue' && (
                <div className="flex gap-2">
                  <button
                    className="text-xs bg-zinc-700 hover:bg-zinc-600 px-2 py-1 rounded"
                    onClick={() => {
                      if (queue.length === 0) return;
                      const s = queue.map(normalizeSongMediaType);
                      setCurrentMusic({ ...currentMusic, songs: s, song: s[0] });
                      setIsPlaying(true);
                      setMobilePlayerVisible(true);
                      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                        const audioUrls = s.map(x => x.url).filter(u => u && !String(u).toLowerCase().endsWith('.mp4'));
                        navigator.serviceWorker.controller.postMessage({ type: 'SET_ALBUM_CACHE', audioUrls, coverUrl: null });
                      }
                    }}
                  >Reproducir todo</button>
                  <button className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded" onClick={clearQueue}>Limpiar</button>
                </div>
              )}
              {mobileQueueTab === 'cache' && (
                <button
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded"
                  onClick={() => getCachedAlbumInfo().then(setCachedAlbumInfo)}
                  title="Actualizar"
                >↺ Actualizar</button>
              )}
            </div>

            {mobileQueueTab === 'queue' && (
              <div className="space-y-2">
                {queue.length === 0 && <div className="text-sm text-zinc-400">Sin elementos en cola.</div>}
                {queue.map((song, index) => (
                  <div key={`${song.url}-${index}`} className="flex items-center gap-3 rounded-md bg-zinc-800/70 px-1 py-2">
                    <img src={song.image} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                      <div className="text-xs text-zinc-400 truncate">{song.artists.join(", ")}</div>
                    </div>
                    <button className="text-xs text-red-300 hover:text-red-200" onClick={() => removeFromQueue(index)} title="Quitar de cola">✕</button>
                  </div>
                ))}
              </div>
            )}

            {mobileQueueTab === 'cache' && (
              <div className="space-y-2">
                {cachedSongsForView.length === 0 && <div className="text-sm text-zinc-400">Sin audio en caché.</div>}
                {cachedSongsForView.map(song => {
                  const isCurrent = currentMusic.song?.url === song.url;
                  const songImg = song.image || CACHE_COVER;
                  return (
                    <button
                      key={song.url}
                      type="button"
                      className={`w-full flex items-center gap-3 rounded-md px-1 py-2 text-left transition-colors ${isCurrent ? 'bg-green-900/40' : 'bg-zinc-800/70 active:bg-zinc-700'}`}
                      onClick={() => {
                        const s = cachedSongsForView.map(normalizeSongMediaType);
                        setCurrentMusic({ ...currentMusic, songs: s, song: normalizeSongMediaType(song) });
                        setIsPlaying(true);
                        setMobilePlayerVisible(true);
                      }}
                    >
                      <img src={songImg} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm truncate ${isCurrent ? 'text-green-400 font-medium' : 'text-zinc-100'}`}>{song.title}</div>
                        {song.artists.length > 0 && <div className="text-xs text-zinc-400 truncate">{song.artists.join(", ")}</div>}
                      </div>
                      {isCurrent && <span className="text-green-400 text-xs shrink-0">●</span>}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </section>
    );
  }

  // ─── DESKTOP RENDER ───────────────────────────────────────────────────────
  return (
    <section>
      <div className="mb-4 flex gap-3 items-center">
        <label className="flex items-center gap-2 bg-zinc-800/80 rounded-md px-3 py-2 flex-1">
          <span aria-hidden="true">🔎</span>
          <input
            className="bg-transparent outline-none w-full text-sm"
            placeholder="Buscar álbum, autor o contenido"
            value={albumInput}
            onChange={(e) => {
              const v = e.target.value;
              setAlbumInput(v);
              setContentInput(v);
            }}
          />
          {albumInput && (
            <button
              type="button"
              className="text-zinc-500 hover:text-zinc-300 shrink-0"
              onClick={() => { setAlbumInput(''); setContentInput(''); }}
              title="Limpiar búsqueda"
            >✕</button>
          )}
        </label>
        <div className="flex items-center gap-2 shrink-0">
          {historyItems.length > 0 && (
            <button
              type="button"
              className="text-xs text-zinc-400 hover:text-zinc-200 px-3 py-1.5 rounded-md bg-zinc-800/80 transition-colors"
              onClick={() => setShowHistoryView(v => !v)}
            >
              {showHistoryView ? '← Volver' : 'Historial'}
            </button>
          )}
          {fontSizeControls}
        </div>
      </div>

      {showDesktopSearchSpinner && (
        <div className="mb-3 flex items-center gap-2 text-xs text-zinc-400">
          <div className="h-3 w-3 rounded-full border-2 border-zinc-600 border-t-green-500 animate-spin" />
          Buscando...
        </div>
      )}

      {loadingPage && playlists.length === 0 && (
        <div className="flex justify-center py-16">
          <div className="h-12 w-12 rounded-full border-4 border-zinc-700 border-t-green-500 animate-spin" />
        </div>
      )}

      {noCacheOffline && playlists.length === 0 && !loadingPage && (
        <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
          <span className="text-5xl opacity-60">📡</span>
          <p className="text-zinc-300 font-medium">Sin conexión</p>
          <p className="text-zinc-500 text-sm max-w-xs">No hay audios en caché.<br/>Conectate a internet una vez para cargar el catálogo.</p>
        </div>
      )}

      {/* History panel */}
      {showHistoryView && (
        <div className="mt-4 mb-6">
          <h2 className="text-base font-semibold mb-3 text-zinc-300">Últimos 100 audios escuchados</h2>
          {historyItems.length === 0 && <p className="text-zinc-500 text-sm">Sin historial.</p>}
          <div className="grid gap-1">
            {[...historyItems].reverse().map((item, idx) => (
              <div key={`${item.url}-${idx}`} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/50">
                <img src={item.image || CACHE_COVER} alt={item.title} className="w-10 h-10 rounded object-cover shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-zinc-100 truncate">{item.title}</div>
                  <div className="text-xs text-zinc-500 truncate">{item.album}</div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-24 h-1 bg-zinc-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500/70" style={{ width: `${item.percent}%` }} />
                    </div>
                    <span className="text-[10px] text-zinc-500">{item.percent}%</span>
                  </div>
                </div>
                <span className="text-xs text-zinc-600 shrink-0">{timeAgo(item.listenedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!showHistoryView && (
        <>
          {/* Category pills — always visible when not searching */}
          {!hasTextSearch && categoryPills}

          {/* Cache view */}
          {showCacheView ? (
            <div className="mt-2">
              <div className="flex items-center gap-3 mb-5">
                <button type="button" className="text-zinc-400 hover:text-white" onClick={() => setShowCacheView(false)}>← Volver</button>
                <h2 className="text-lg font-semibold">Audios en caché</h2>
              </div>
              <div className="flex gap-4 items-start mb-6 p-4 rounded-xl bg-gradient-to-r from-green-950/60 to-zinc-900 w-fit">
                <img src={cachedAlbumInfo.coverUrl ?? CACHE_COVER} alt="Caché" className="w-24 h-24 rounded-lg object-cover shadow-lg shrink-0" />
                <div>
                  <p className="text-xs text-zinc-500 uppercase tracking-wide mb-0.5">Lista offline</p>
                  <h3 className="text-lg font-bold text-white">Audios en caché</h3>
                  <p className="text-sm text-zinc-400 mt-0.5">{cachedSongsForView.length} archivos disponibles</p>
                  {cachedSongsForView.length > 0 && (
                    <button
                      type="button"
                      className="mt-2 bg-green-500 hover:bg-green-400 text-black text-sm font-bold px-4 py-1.5 rounded-full"
                      onClick={() => {
                        const s = cachedSongsForView.map(normalizeSongMediaType);
                        setCurrentMusic({ ...currentMusic, songs: s, song: s[0] });
                        setIsPlaying(true);
                      }}
                    >▶ Reproducir todo</button>
                  )}
                </div>
              </div>
              {cachedSongsForView.length === 0 && <p className="text-zinc-500 text-sm">Sin audio en caché.</p>}
              <div className="grid gap-1.5">
                {cachedSongsForView.map((song, idx) => {
                  const isCurrent = currentMusic.song?.url === song.url;
                  const songImg = song.image || CACHE_COVER;
                  const size = cachedAlbumInfo.fileSizes[song.url];
                  return (
                    <button
                      key={song.url}
                      type="button"
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left hover:bg-zinc-800 ${isCurrent ? 'bg-zinc-800' : ''}`}
                      onClick={() => {
                        const s = cachedSongsForView.map(normalizeSongMediaType);
                        setCurrentMusic({ ...currentMusic, songs: s, song: normalizeSongMediaType(song) });
                        setIsPlaying(true);
                      }}
                    >
                      <span className="text-xs text-zinc-600 w-6 shrink-0 text-right">{idx + 1}</span>
                      <img src={songImg} alt={song.title} className="w-10 h-10 rounded object-cover shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm truncate ${isCurrent ? 'text-green-400 font-medium' : 'text-zinc-100'}`}>{song.title}</div>
                        {song.artists.length > 0 && <div className="text-xs text-zinc-500 truncate">{song.artists.join(', ')}</div>}
                      </div>
                      {size && <span className="text-xs text-zinc-600 shrink-0">{fmtSize(size)}</span>}
                      {isCurrent && <span className="text-green-400 text-sm shrink-0">●</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : hasTextSearch ? (
            /* ── SEARCH RESULTS: albums + songs ───────────────────── */
            <>
              <p className="text-sm text-zinc-400 mb-4">
                {filteredAlbums.length} álbumes · {filteredSongs.length} audios
                {moreToLoad ? ' (cargando más…)' : ''}
              </p>

              {filteredAlbums.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Álbumes</h3>
                  <div className="flex flex-wrap gap-4 mb-8">
                    {filteredAlbums.map((playlist) => (
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
                              const img = e.currentTarget; img.onerror = null;
                              img.src = `${baseUrl}default-cover.svg`;
                            }}
                          />
                        </picture>
                        {listenedAlbumIds.has(playlist.albumId) && (
                          <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-md z-10">
                            <span className="text-white text-[10px] font-bold leading-none">✓</span>
                          </div>
                        )}
                        {typeof playlist.songCount === 'number' && playlist.songCount > 0 && (
                          <div className="absolute top-3 left-3 min-w-[18px] h-[18px] rounded-full bg-black/75 text-white text-[10px] font-bold leading-none flex items-center justify-center px-1 z-10">
                            {playlist.songCount}
                          </div>
                        )}
                        <div className="flex flex-auto flex-col px-2">
                          <h4 className="text-white text-sm line-clamp-2">{playlist.title}</h4>
                          <span className="text-xs text-gray-400 truncate">{playlist.artists.join(", ")}</span>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {filteredSongs.length > 0 && (
                <>
                  <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-500 mb-3">Audios</h3>
                  <div className="grid gap-2">
                    {filteredSongs.map(({ song, album }) => (
                      <a
                        key={song.url}
                        href={`${baseUrl}playlist/${album.id}/`}
                        className="flex items-center gap-3 rounded-md bg-zinc-800/70 hover:bg-zinc-700 px-3 py-2"
                      >
                        <img src={song.image} alt={song.title} className="w-12 h-12 object-cover rounded" />
                        <div className="min-w-0">
                          <div className="text-sm text-zinc-100 truncate">{song.title}</div>
                          <div className="text-xs text-zinc-400 truncate">{song.artists.join(", ")}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                </>
              )}

              {filteredAlbums.length === 0 && filteredSongs.length === 0 && (
                <p className="text-zinc-500 text-sm mt-4">Sin resultados.</p>
              )}
            </>
          ) : (
            /* ── HOME VIEW ────────────────────────────────────────── */
            <>
              {selectedCategory && (
                <p className="text-sm text-zinc-400 mb-4">
                  {categoryFilteredPlaylists.length} álbumes en esta categoría
                </p>
              )}
              <div className="flex flex-wrap mt-2 gap-4">
                {/* Cache card */}
                <button
                  type="button"
                  onClick={() => setShowCacheView(true)}
                  className="group relative hover:bg-zinc-800 shadow-lg hover:shadow-xl bg-zinc-500/30 rounded-md transition-all duration-300 flex p-2 overflow-hidden gap-2 pb-6 w-44 flex-col"
                >
                  <div className="w-40 h-40 flex-none overflow-hidden rounded-md bg-zinc-900">
                    <img src={cachedAlbumInfo.coverUrl ?? CACHE_COVER} alt="Caché" className="object-cover w-full h-full rounded-md" />
                  </div>
                  {cachedSongsForView.length > 0 && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-md z-10">
                      <span className="text-white text-[10px] font-bold leading-none">✓</span>
                    </div>
                  )}
                  <div className="flex flex-auto flex-col px-2">
                    <h4 className="text-white text-sm line-clamp-2">Audios en caché</h4>
                    <span className="text-xs text-gray-400 truncate">
                      {cachedSongsForView.length > 0 ? `${cachedSongsForView.length} archivos` : 'Sin caché'}
                    </span>
                  </div>
                </button>

                {/* Recent albums — circle progress + always checked */}
                {recentFilteredAlbums.map((recent) => {
                  const listenedPct = recent.totalSongs > 0
                    ? Math.round((recent.listenedSongUrls.length / recent.totalSongs) * 100)
                    : 0;
                  return (
                    <a
                      key={`recent-${recent.id}`}
                      href={`${baseUrl}playlist/${recent.id}/`}
                      className="group relative hover:bg-zinc-800 shadow-lg hover:shadow-xl bg-zinc-700/40 rounded-md transition-all duration-300 flex p-2 overflow-hidden gap-2 pb-6 w-44 flex-col"
                    >
                      {/* Circle progress ring around cover */}
                      <div className="relative w-40 h-40 flex-none">
                        <CircleRing pct={listenedPct} />
                        <div className="absolute inset-[5px] overflow-hidden rounded-md bg-zinc-900">
                          <img
                            src={recent.cover}
                            alt={`Cover of ${recent.title}`}
                            className="object-cover w-full h-full rounded-md"
                            loading="lazy"
                          />
                          {/* Always show check: album has been opened */}
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-md z-10">
                            <span className="text-white text-[10px] font-bold leading-none">✓</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-auto flex-col px-2">
                        <h4 className="text-white text-sm line-clamp-2">{recent.title}</h4>
                        <span className="text-[10px] text-zinc-500 truncate">{timeAgo(recent.openedAt)}</span>
                        {listenedPct > 0 && (
                          <span className="text-[10px] text-green-500/80 mt-0.5">{listenedPct}% escuchado</span>
                        )}
                      </div>
                    </a>
                  );
                })}

                {/* Rest of library */}
                {homeOtherAlbums.map((playlist) => (
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
                          const img = e.currentTarget; img.onerror = null;
                          img.src = `${baseUrl}default-cover.svg`;
                        }}
                      />
                    </picture>
                    {listenedAlbumIds.has(playlist.albumId) && (
                      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-green-500/90 flex items-center justify-center shadow-md z-10">
                        <span className="text-white text-[10px] font-bold leading-none">✓</span>
                      </div>
                    )}
                    {typeof playlist.songCount === 'number' && playlist.songCount > 0 && (
                      <div className="absolute top-3 left-3 min-w-[18px] h-[18px] rounded-full bg-black/75 text-white text-[10px] font-bold leading-none flex items-center justify-center px-1 z-10">
                        {playlist.songCount}
                      </div>
                    )}
                    <div className="flex flex-auto flex-col px-2">
                      <h4 className="text-white text-sm line-clamp-2">{playlist.title}</h4>
                      <span className="text-xs text-gray-400 truncate">{playlist.artists.join(", ")}</span>
                    </div>
                  </a>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <div ref={sentinelRef} className="py-4 text-center text-xs text-zinc-500">
        {loadingPage ? "Cargando más..." : moreToLoad ? "" : (!hasTextSearch ? "Fin de resultados" : "")}
      </div>
    </section>
  );
}
