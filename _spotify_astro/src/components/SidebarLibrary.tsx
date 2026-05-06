import { useEffect, useMemo, useRef, useState } from "react";
import type { Playlist } from "@/lib/types";

interface Props {
  playlists: Playlist[];
  baseUrl: string;
}

const PAGE_SIZE = 120;

export function SidebarLibrary({ playlists, baseUrl }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [activeId, setActiveId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  const items = useMemo(() => playlists.slice(0, visible), [playlists, visible]);

  useEffect(() => {
    const match = window.location.pathname.match(/playlist\/(album-\d+)/);
    if (match?.[1]) setActiveId(match[1]);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const el = document.querySelector(`[data-playlist-id="${activeId}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId, visible]);

  useEffect(() => {
    if (!rootRef.current || !sentinelRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) {
          setVisible((v) => Math.min(v + PAGE_SIZE, playlists.length));
        }
      },
      { root: rootRef.current, threshold: 0.1 }
    );
    observer.observe(sentinelRef.current);
    return () => observer.disconnect();
  }, [playlists.length]);

  return (
    <div ref={rootRef} className="overflow-y-auto max-h-[68vh]">
      <ul>
        {items.map((playlist) => (
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
        {visible < playlists.length ? "Cargando más..." : "Fin de la biblioteca"}
      </div>
    </div>
  );
}
