import { useMemo } from "react";

interface YoutubeIconButtonProps {
  youtubeId?: string | null;
  onOpen: (youtubeId: string) => void;
  className?: string;
}

export function YoutubeIconButton({ youtubeId, onOpen, className = "" }: YoutubeIconButtonProps) {
  if (!youtubeId || youtubeId.length !== 11) return null;
  return (
    <button
      type="button"
      className={`shrink-0 rounded bg-red-600/90 hover:bg-red-500 text-white text-[10px] font-bold px-2 py-1 ${className}`}
      onClick={(e) => {
        e.stopPropagation();
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("player:pause", { detail: { reason: "open-youtube-modal" } }));
        }
        onOpen(youtubeId);
      }}
      title="Ver video de YouTube"
      aria-label="Ver video de YouTube"
    >
      ▶ YT
    </button>
  );
}

interface YoutubeVideoModalProps {
  youtubeId: string | null;
  onClose: () => void;
}

export function YoutubeVideoModal({ youtubeId, onClose }: YoutubeVideoModalProps) {
  const embedUrl = useMemo(() => {
    if (!youtubeId || youtubeId.length !== 11) return "";
    return `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0`;
  }, [youtubeId]);

  if (!youtubeId || !embedUrl) return null;

  return (
    <div className="fixed inset-0 z-[1200] bg-black/80 flex items-center justify-center p-3" onClick={onClose}>
      <div className="w-full max-w-4xl bg-zinc-950 rounded-lg overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-100">Video de YouTube</h3>
          <button type="button" className="text-zinc-400 hover:text-white" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="aspect-video w-full bg-black">
          <iframe
            src={embedUrl}
            title="YouTube video player"
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        </div>
      </div>
    </div>
  );
}
