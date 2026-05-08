import { useEffect, useState } from "react";

async function probeConnectivity(): Promise<boolean> {
  try {
    const r = await fetch('/_audios/categories.json', {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      window.dispatchEvent(new Event('online'));
      return true;
    }
  } catch {}
  return false;
}

export { probeConnectivity };

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [toast, setToast] = useState('');

  // ── Online / offline detection ─────────────────────────────────────────────
  useEffect(() => {
    // Show immediately on mount if already offline — no debounce
    if (!navigator.onLine) setOffline(true);

    let timer: ReturnType<typeof setTimeout>;
    const goOnline  = () => { clearTimeout(timer); setOffline(false); };
    // Small debounce on mid-session offline to avoid flicker on unstable connections
    const goOffline = () => {
      clearTimeout(timer);
      timer = setTimeout(() => setOffline(true), 500);
    };

    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  // ── Periodic connectivity probe every 10 s while offline ──────────────────
  useEffect(() => {
    if (!offline) return;
    const id = setInterval(probeConnectivity, 10_000);
    return () => clearInterval(id);
  }, [offline]);

  // ── Intercept playlist-link clicks while offline ───────────────────────────
  useEffect(() => {
    if (!offline) return;

    const handleClick = (e: MouseEvent) => {
      const link = (e.target as Element).closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.includes('/playlist/')) return;

      const clickedId  = href.match(/playlist\/(album-[\w-]+)/)?.[1];
      const cachedId   = localStorage.getItem('sw:cachedPlaylistId');
      const cachedUrl  = localStorage.getItem('sw:cachedPlaylistUrl');

      // Clicking the already-cached album → allow navigation normally
      if (clickedId && clickedId === cachedId) return;

      e.preventDefault();
      e.stopPropagation();

      if (cachedUrl) {
        setToast('Sin conexión — mostrando álbum en caché');
        // Small delay so the toast renders before navigation
        setTimeout(() => { window.location.href = cachedUrl; }, 350);
      } else {
        setToast('Sin conexión — no hay álbum en caché');
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [offline]);

  // ── Auto-dismiss toast after 3 s ──────────────────────────────────────────
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(id);
  }, [toast]);

  if (!offline) return null;

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-[2000] bg-amber-600 text-white text-xs text-center py-1.5 px-4 font-medium">
        Sin conexión — mostrando contenido en caché
      </div>
      {toast && (
        <div className="fixed top-7 left-0 right-0 z-[2001] bg-zinc-900 border-b border-amber-500/50 text-amber-300 text-xs text-center py-1.5 px-4 animate-pulse">
          {toast}
        </div>
      )}
    </>
  );
}
