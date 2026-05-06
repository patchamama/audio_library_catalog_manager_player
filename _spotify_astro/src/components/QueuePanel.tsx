import { usePlayerStore } from "@/store/playerStore";

export function QueuePanel() {
  const { queue, clearQueue } = usePlayerStore((s) => s);
  return (
    <div className="mt-3 p-2 rounded-md bg-zinc-900 border border-zinc-800">
      <div className="flex items-center justify-between">
        <h4 className="text-sm text-zinc-200">Cola</h4>
        <button className="text-xs text-zinc-400 hover:text-zinc-200" onClick={clearQueue}>Limpiar</button>
      </div>
      <ul className="mt-2 max-h-36 overflow-y-auto text-xs text-zinc-400">
        {queue.length === 0 && <li>Sin elementos en cola</li>}
        {queue.map((s, i) => (
          <li key={`${s.url}-${i}`} className="truncate py-1">{i + 1}. {s.title}</li>
        ))}
      </ul>
    </div>
  );
}
