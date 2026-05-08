import { useEffect, useState } from "react";

export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const goOnline = () => {
      clearTimeout(timer);
      setOffline(false);
    };
    const goOffline = () => {
      clearTimeout(timer);
      // Debounce 2 s — avoids false positives on page load and slow networks
      timer = setTimeout(() => setOffline(true), 2000);
    };

    if (!navigator.onLine) {
      timer = setTimeout(() => setOffline(true), 2000);
    }

    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[2000] bg-amber-600 text-white text-xs text-center py-1.5 px-4 font-medium">
      Sin conexión — mostrando contenido en caché
    </div>
  );
}
