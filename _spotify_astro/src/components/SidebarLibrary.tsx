import { useCallback, useEffect, useRef, useState } from "react";
import type { Playlist } from "@/lib/types";
import { fetchPlaylists } from "@/services/ApiService";

interface Props {
  baseUrl: string;
}

export function SidebarLibrary({ baseUrl }: Props) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [apiPage, setApiPage] = useState(0);
  const [apiTotalPages, setApiTotalPages] = useState(1);
  const [loadingPage, setLoadingPage] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setLoadingPage(true);
    fetchPlaylists(1, 120)
      .then(data => {
        setPlaylists(data.playlists);
        setApiPage(1);
        setApiTotalPages(data.totalPages);
        setLoadingPage(false);
      })
      .catch(() => setLoadingPage(false));
  }, []);

  // Reload when connection is restored (OfflineBanner dispatches 'online' event via probe)
  useEffect(() => {
    const handleOnline = () => {
      if (playlists.length > 0) return; // already loaded
      setLoadingPage(true);
      fetchPlaylists(1, 120)
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
  }, [playlists.length]);

  const loadNextPage = useCallback(() => {
    if (loadingPage || apiPage >= apiTotalPages) return;
    setLoadingPage(true);
    fetchPlaylists(apiPage + 1, 120)
      .then(data => {
        setPlaylists(prev => [...prev, ...data.playlists]);
        setApiPage(data.page);
        setApiTotalPages(data.totalPages);
        setLoadingPage(false);
      })
      .catch(() => setLoadingPage(false));
  }, [loadingPage, apiPage, apiTotalPages]);

  useEffect(() => {
    const match = window.location.pathname.match(/playlist\/(album-\d+)/);
    if (match?.[1]) setActiveId(match[1]);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const el = document.querySelector(`[data-playlist-id="${activeId}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId, playlists]);

  useEffect(() => {
    if (!rootRef.current || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadNextPage();
      },
      { root: rootRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [loadNextPage]);

  return (
    <div ref={rootRef} className="overflow-y-auto max-h-[68vh]">
      <ul>
        {playlists.map((playlist) => (
          <li key={playlist.id}>
            <a
              href={`${baseUrl}playlist/${playlist.id}/`}
              data-playlist-id={playlist.id}
              className={`playlist-item flex relative p-2 overflow-hidden items-center gap-5 rounded-md hover:bg-zinc-800 ${activeId === playlist.id ? "bg-zinc-800/80" : ""}`}
            >
              <picture className="h-12 w-12 flex-none">
                <img
                  src={playlist.cover}
                  alt={playlist.title}
                  className="object-cover w-full h-full rounded-md"
                  loading="lazy"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = `${baseUrl}default-cover.svg`;
                  }}
                />
              </picture>
              <div className="flex flex-auto flex-col truncate">
                <h4 className="text-white text-sm">{playlist.title}</h4>
                <span className="text-xs text-gray-400">{playlist.artists.join(", ")}</span>
              </div>
            </a>
          </li>
        ))}
      </ul>
      <div ref={sentinelRef} className="py-3 text-center text-xs text-zinc-500">
        {loadingPage ? "Cargando más..." : apiPage >= apiTotalPages ? "Fin de la biblioteca" : ""}
      </div>
    </div>
  );
}
