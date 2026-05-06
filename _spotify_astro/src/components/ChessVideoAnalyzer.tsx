import { useEffect, useMemo, useRef, useState } from "react";
import { Chess } from "chess.js";

type MoveLine = {
  multipv: number;
  score: string;
  pv: string[];
};

type PieceCode = "K" | "Q" | "R" | "B" | "N" | "P" | "k" | "q" | "r" | "b" | "n" | "p";

type BoardMap = Record<string, PieceCode | null>;

const START_FEN = "start";
const BASE_URL = import.meta.env.BASE_URL || "/";
const ASSET_BASE = BASE_URL === "/" ? "/_audios/spotify/" : (BASE_URL.endsWith("/") ? BASE_URL : `${BASE_URL}/`);
const PGN_VIEWER_JS = "https://cdn.jsdelivr.net/npm/@mliebelt/pgn-viewer@1.6.11/lib/dist.js";
const PGN_VIEWER_CSS = `${ASSET_BASE}pgn-viewer.css`;
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"];
const PIECE_TO_IMG: Record<PieceCode, string> = {
  K: `${ASSET_BASE}images/pieces/merida/wK.svg`,
  Q: `${ASSET_BASE}images/pieces/merida/wQ.svg`,
  R: `${ASSET_BASE}images/pieces/merida/wR.svg`,
  B: `${ASSET_BASE}images/pieces/merida/wB.svg`,
  N: `${ASSET_BASE}images/pieces/merida/wN.svg`,
  P: `${ASSET_BASE}images/pieces/merida/wP.svg`,
  k: `${ASSET_BASE}images/pieces/merida/bK.svg`,
  q: `${ASSET_BASE}images/pieces/merida/bQ.svg`,
  r: `${ASSET_BASE}images/pieces/merida/bR.svg`,
  b: `${ASSET_BASE}images/pieces/merida/bB.svg`,
  n: `${ASSET_BASE}images/pieces/merida/bN.svg`,
  p: `${ASSET_BASE}images/pieces/merida/bP.svg`,
};

function parseScore(raw: string) {
  const mate = raw.match(/score mate (-?\d+)/);
  if (mate) return `#${mate[1]}`;
  const cp = raw.match(/score cp (-?\d+)/);
  if (cp) return (Number(cp[1]) / 100).toFixed(2);
  return "…";
}

function parseMultipv(raw: string) {
  const pv = raw.match(/multipv (\d+)/);
  return pv ? Number(pv[1]) : 1;
}

function parsePv(raw: string) {
  const m = raw.match(/\spv\s(.+)$/);
  return m ? m[1].trim().split(/\s+/) : [];
}

function emptyBoardMap(): BoardMap {
  const map: BoardMap = {};
  for (const rank of RANKS) {
    for (const file of FILES) {
      map[`${file}${rank}`] = null;
    }
  }
  return map;
}

function fenToBoardMap(fen: string): BoardMap {
  const map = emptyBoardMap();
  const boardPart = fen.split(" ")[0] || "8/8/8/8/8/8/8/8";
  const rows = boardPart.split("/");
  for (let r = 0; r < Math.min(rows.length, 8); r += 1) {
    let fileIdx = 0;
    for (const ch of rows[r]) {
      if (/\d/.test(ch)) {
        fileIdx += Number(ch);
      } else {
        if (fileIdx < 8) {
          const sq = `${FILES[fileIdx]}${RANKS[r]}`;
          map[sq] = ch as PieceCode;
        }
        fileIdx += 1;
      }
    }
  }
  return map;
}

function boardMapToFen(board: BoardMap, turn: "w" | "b") {
  const rows: string[] = [];
  for (const rank of RANKS) {
    let row = "";
    let empties = 0;
    for (const file of FILES) {
      const sq = `${file}${rank}`;
      const piece = board[sq];
      if (!piece) {
        empties += 1;
      } else {
        if (empties > 0) {
          row += String(empties);
          empties = 0;
        }
        row += piece;
      }
    }
    if (empties > 0) row += String(empties);
    rows.push(row || "8");
  }
  return `${rows.join("/")} ${turn} - - 0 1`;
}

interface ChessVideoAnalyzerProps {
  contextKey?: string;
  userId?: string | null;
}

const flipPieceColor = (piece: PieceCode): PieceCode =>
  (piece === piece.toLowerCase() ? piece.toUpperCase() : piece.toLowerCase()) as PieceCode;

export function ChessVideoAnalyzer({ contextKey = "default", userId = null }: ChessVideoAnalyzerProps) {
  const [fen, setFen] = useState(START_FEN);
  const [boardFen, setBoardFen] = useState(START_FEN);
  const [pgnInput, setPgnInput] = useState("");
  const [fenInput, setFenInput] = useState("");
  const [notes, setNotes] = useState("");
  const [analysisLines, setAnalysisLines] = useState<MoveLine[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisBaseFen, setAnalysisBaseFen] = useState(START_FEN);
  const [fitBoard, setFitBoard] = useState(true);
  const [openSession, setOpenSession] = useState(false);
  const [openFixed, setOpenFixed] = useState(false);
  const [openNotes, setOpenNotes] = useState(false);
  const [viewerReady, setViewerReady] = useState(false);
  const [boardWidth, setBoardWidth] = useState(360);
  const [flipBoard, setFlipBoard] = useState(false);
  const [engineReady, setEngineReady] = useState(false);
  const [engineInitNonce, setEngineInitNonce] = useState(0);
  const [notesStatus, setNotesStatus] = useState("");
  const [engineEnabled, setEngineEnabled] = useState(true);

  const [setupTurn, setSetupTurn] = useState<"w" | "b">("w");
  const [setupBoard, setSetupBoard] = useState<BoardMap>(() => fenToBoardMap(new Chess().fen()));
  const [selectedPiece, setSelectedPiece] = useState<PieceCode | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const engineReadyRef = useRef(false);
  const analyzeTimeoutRef = useRef<number | null>(null);
  const linesRef = useRef<Record<number, MoveLine>>({});
  const boardHostRef = useRef<HTMLDivElement | null>(null);
  const boardWrapRef = useRef<HTMLDivElement | null>(null);
  const triedAsmFallbackRef = useRef(false);

  useEffect(() => {
    const ensureCss = () => {
      const existing = document.querySelector(`link[data-pgn-viewer="1"]`) as HTMLLinkElement | null;
      if (existing) return;
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = PGN_VIEWER_CSS;
      link.dataset.pgnViewer = "1";
      document.head.appendChild(link);
    };

    const ensureScript = () =>
      new Promise<void>((resolve, reject) => {
        if ((window as unknown as { PGNV?: unknown }).PGNV) {
          resolve();
          return;
        }
        const existing = document.querySelector(`script[data-pgn-viewer="1"]`) as HTMLScriptElement | null;
        if (existing) {
          existing.addEventListener("load", () => resolve(), { once: true });
          existing.addEventListener("error", () => reject(new Error("No se pudo cargar pgn-viewer")), { once: true });
          return;
        }
        const script = document.createElement("script");
        script.src = PGN_VIEWER_JS;
        script.async = true;
        script.dataset.pgnViewer = "1";
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("No se pudo cargar pgn-viewer"));
        document.body.appendChild(script);
      });

    let mounted = true;
    ensureCss();
    ensureScript()
      .then(() => {
        if (mounted) setViewerReady(true);
      })
      .catch(() => {
        if (mounted) setViewerReady(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const computeWidth = () => {
      const wrap = boardWrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const viewportAvailable = Math.floor(window.innerWidth - rect.left - 12);
      const viewportHeightAvailable = Math.floor(window.innerHeight - rect.top - 24);
      const fromContainer = Math.floor(rect.width - 12);
      let visible = fromContainer;
      if (viewportAvailable > 0) visible = Math.min(visible, viewportAvailable);
      if (viewportHeightAvailable > 0) visible = Math.min(visible, viewportHeightAvailable);
      const clamped = Math.max(220, Math.min(360, visible));
      setBoardWidth(clamped);
    };

    computeWidth();
    const ro = new ResizeObserver(computeWidth);
    if (boardWrapRef.current) ro.observe(boardWrapRef.current);
    window.addEventListener("resize", computeWidth);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", computeWidth);
    };
  }, [fitBoard]);

  useEffect(() => {
    if (!viewerReady || !boardHostRef.current) return;
    const PGNV = (window as unknown as { PGNV?: { pgnBoard?: (id: string, cfg: Record<string, unknown>) => void } }).PGNV;
    if (!PGNV?.pgnBoard) return;
    boardHostRef.current.innerHTML = "";
    const position = boardFen === START_FEN ? "start" : boardFen;
    PGNV.pgnBoard("pgn-viewer-board", {
      position,
      locale: "es",
      pieceStyle: "merida",
      theme: "zeit",
      width: `${boardWidth}px`,
      showCoords: true,
      orientation: flipBoard ? "black" : "white",
      coordinates: true,
    });
  }, [viewerReady, boardFen, boardWidth, flipBoard]);

  useEffect(() => {
    const createWorker = (forceAsm = false) => {
      const canUseSharedMemory =
        !forceAsm &&
        typeof globalThis !== "undefined" &&
        "SharedArrayBuffer" in globalThis &&
        typeof window !== "undefined" &&
        window.crossOriginIsolated === true;
      const stockfishScript = canUseSharedMemory ? "stockfish/bin/stockfish-18.js" : "stockfish/bin/stockfish-18-asm.js";
      const worker = new Worker(new URL(stockfishScript, import.meta.url));
      setEngineReady(false);
      engineReadyRef.current = false;
      workerRef.current = worker;
      worker.postMessage("uci");
      worker.postMessage("setoption name MultiPV value 3");
      return worker;
    };

    let worker = createWorker(false);
    worker.onerror = (event) => {
      const message = String((event as ErrorEvent).message || "");
      if (!triedAsmFallbackRef.current && message.toLowerCase().includes("sharedarraybuffer")) {
        triedAsmFallbackRef.current = true;
        try {
          worker.terminate();
        } catch {
          // ignore
        }
        worker = createWorker(true);
        worker.onerror = () => setAnalyzing(false);
        worker.onmessage = onMessage;
        return;
      }
      setAnalyzing(false);
      setEngineReady(false);
      engineReadyRef.current = false;
    };

    const onMessage = (event: MessageEvent) => {
      const raw = String(event.data || "");
      if (raw.includes("uciok")) {
        engineReadyRef.current = true;
        setEngineReady(true);
      }
      if (raw.includes("info depth") && raw.includes(" pv ")) {
        const line: MoveLine = {
          multipv: parseMultipv(raw),
          score: parseScore(raw),
          pv: parsePv(raw),
        };
        linesRef.current[line.multipv] = line;
        const lines = Object.values(linesRef.current)
          .sort((a, b) => a.multipv - b.multipv)
          .slice(0, 3);
        setAnalysisLines(lines);
      }
      if (raw.includes("bestmove")) {
        setAnalyzing(false);
      }
    };
    worker.onmessage = onMessage;
    return () => {
      if (analyzeTimeoutRef.current) window.clearTimeout(analyzeTimeoutRef.current);
      try {
        worker.postMessage("quit");
      } catch {
        // ignore
      }
      worker.terminate();
      workerRef.current = null;
    };
  }, [engineInitNonce]);

  useEffect(() => {
    if (!workerRef.current || !engineReadyRef.current || fitBoard || !engineEnabled) return;
    const currentFen = fen === START_FEN ? new Chess().fen() : fen;
    linesRef.current = {};
    setAnalysisLines([]);
    setAnalyzing(true);
    setAnalysisBaseFen(currentFen);
    workerRef.current.postMessage("stop");
    workerRef.current.postMessage(`position fen ${currentFen}`);
    workerRef.current.postMessage("go depth 12");
    if (analyzeTimeoutRef.current) window.clearTimeout(analyzeTimeoutRef.current);
    analyzeTimeoutRef.current = window.setTimeout(() => setAnalyzing(false), 5000);
  }, [fen, engineReady, fitBoard, engineEnabled]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = `chess:notes:${contextKey}`;
    if (!userId) {
      setNotes(localStorage.getItem(key) || "");
      return;
    }
    fetch(`${ASSET_BASE}api/chess-notes.json?context=${encodeURIComponent(contextKey)}&user=${encodeURIComponent(userId)}`)
      .then((r) => (r.ok ? r.json() : Promise.resolve({ note: "" })))
      .then((data) => setNotes(typeof data?.note === "string" ? data.note : ""))
      .catch(() => setNotes(localStorage.getItem(key) || ""));
  }, [contextKey, userId]);

  const syncSetupToFen = (nextBoard: BoardMap, nextTurn: "w" | "b" = setupTurn) => {
    const nextFen = boardMapToFen(nextBoard, nextTurn);
    setBoardFen(nextFen);
    setFen(nextFen);
    setFenInput(nextFen);
  };

  const setStartPosition = () => {
    const start = new Chess().fen();
    const nextMap = fenToBoardMap(start);
    setSetupBoard(nextMap);
    setSetupTurn("w");
    setBoardFen(START_FEN);
    setFen(START_FEN);
    setFenInput(start);
  };

  const clearBoardSetup = () => {
    const next = emptyBoardMap();
    setSetupBoard(next);
    syncSetupToFen(next);
  };

  const onSetupSquareClick = (sq: string) => {
    setSetupBoard((prev) => {
      const next = { ...prev };
      if (selectedPiece) {
        next[sq] = selectedPiece;
      } else {
        next[sq] = null;
      }
      syncSetupToFen(next);
      return next;
    });
  };

  const setSquarePiece = (sq: string, piece: PieceCode | null) => {
    setSetupBoard((prev) => {
      const next = { ...prev, [sq]: piece };
      syncSetupToFen(next);
      return next;
    });
  };

  const liftPiece = (sq: string) => {
    const piece = setupBoard[sq];
    if (!piece) return;
    setSelectedPiece(piece);
    const next = { ...setupBoard, [sq]: null };
    setSetupBoard(next);
    syncSetupToFen(next);
  };

  const resetBoard = () => {
    setStartPosition();
  };

  const loadPgn = () => {
    const tmp = new Chess();
    const ok = tmp.loadPgn(pgnInput);
    if (!ok) return;
    const nextFen = tmp.fen();
    setBoardFen(nextFen);
    setFen(nextFen);
    setFenInput(nextFen);
    setSetupBoard(fenToBoardMap(nextFen));
    setSetupTurn((nextFen.split(" ")[1] as "w" | "b") || "w");
  };

  const loadFen = () => {
    const value = fenInput.trim();
    const tmp = new Chess();
    try {
      tmp.load(value);
      setBoardFen(value);
      setFen(value);
      setSetupBoard(fenToBoardMap(value));
      setSetupTurn((value.split(" ")[1] as "w" | "b") || "w");
    } catch {
      // ignore invalid fen
    }
  };

  const applyPvUntil = (line: MoveLine, idx: number) => {
    const tmp = new Chess(analysisBaseFen === START_FEN ? new Chess().fen() : analysisBaseFen);
    for (let i = 0; i <= idx; i += 1) {
      const move = line.pv[i];
      if (!move) break;
      tmp.move(move, { sloppy: true });
    }
    const nextFen = tmp.fen();
    setBoardFen(nextFen);
    setFen(nextFen);
    setFenInput(nextFen);
    setSetupBoard(fenToBoardMap(nextFen));
    setSetupTurn((nextFen.split(" ")[1] as "w" | "b") || "w");
  };

  const orderedRanks = flipBoard ? [...RANKS].reverse() : RANKS;
  const orderedFiles = flipBoard ? [...FILES].reverse() : FILES;
  const overlaySquares = orderedRanks.flatMap((rank) => orderedFiles.map((file) => `${file}${rank}`));
  const pieceRows = useMemo(
    () => (["K", "Q", "R", "B", "N", "P"] as PieceCode[]).map((w) => [w, w.toLowerCase() as PieceCode]),
    []
  );

  const saveNotes = async () => {
    if (typeof window === "undefined") return;
    const key = `chess:notes:${contextKey}`;
    if (!userId) {
      localStorage.setItem(key, notes);
      setNotesStatus("Guardado en este navegador.");
      window.setTimeout(() => setNotesStatus(""), 1800);
      return;
    }
    try {
      const r = await fetch(`${ASSET_BASE}api/chess-notes.json`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: contextKey, user: userId, note: notes }),
      });
      if (!r.ok) throw new Error("save failed");
      setNotesStatus("Guardado en SQLite.");
      window.setTimeout(() => setNotesStatus(""), 1800);
    } catch {
      localStorage.setItem(key, notes);
      setNotesStatus("No se pudo guardar en backend. Guardado local.");
      window.setTimeout(() => setNotesStatus(""), 2200);
    }
  };

  return (
    <div className="h-full min-h-0 rounded bg-zinc-900/95 p-3 overflow-auto">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Visor de ajedrez</h3>
        <div className="flex gap-2">
          <button className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700" onClick={() => setFlipBoard((v) => !v)}>
            {flipBoard ? "Negras abajo" : "Blancas abajo"}
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            onClick={() =>
              setFitBoard((v) => {
                const next = !v;
                if (!next) syncSetupToFen(setupBoard, setupTurn);
                return next;
              })
            }
          >
            {fitBoard ? "✍ Edición ON" : "✍ Edición OFF"}
          </button>
          <button
            className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700"
            onClick={() => {
              const next = !engineEnabled;
              setEngineEnabled(next);
              if (!next) {
                setAnalyzing(false);
                setAnalysisLines([]);
                linesRef.current = {};
                try {
                  workerRef.current?.postMessage("stop");
                } catch {
                  // ignore
                }
              } else if (!workerRef.current || !engineReadyRef.current) {
                setEngineInitNonce((n) => n + 1);
              }
            }}
          >
            {engineEnabled ? "Stockfish ON" : "Stockfish OFF"}
          </button>
        </div>
      </div>

      <div className="mb-2 text-xs flex gap-3">
        <button className="underline text-green-400" onClick={setStartPosition}>Posición inicial</button>
        <button className="underline text-amber-300" onClick={clearBoardSetup}>Limpiar tablero</button>
        <span>Turno:</span>
        <button
          className={`px-1.5 rounded ${setupTurn === "w" ? "bg-green-700" : "bg-zinc-700"}`}
          onClick={() => {
            setSetupTurn("w");
            syncSetupToFen(setupBoard, "w");
          }}
        >
          Blancas
        </button>
        <button
          className={`px-1.5 rounded ${setupTurn === "b" ? "bg-green-700" : "bg-zinc-700"}`}
          onClick={() => {
            setSetupTurn("b");
            syncSetupToFen(setupBoard, "b");
          }}
        >
          Negras
        </button>
      </div>

      {fitBoard && (
        <div className="mb-2 rounded bg-zinc-800/70 p-2">
          <div className="text-xs mb-1">Piezas (clic para seleccionar)</div>
          <div className="grid grid-cols-7 gap-1">
            {pieceRows.map(([w, b]) => (
              <div key={w} className="grid grid-rows-2 gap-1">
                <button
                  className={`h-8 w-8 rounded border ${selectedPiece === w ? "border-green-500 bg-zinc-700" : "border-zinc-700 bg-zinc-900"}`}
                  onClick={() => setSelectedPiece(w)}
                  title="Seleccionar pieza blanca"
                >
                  <img src={PIECE_TO_IMG[w]} alt={w} className="h-6 w-6 mx-auto" />
                </button>
                <button
                  className={`h-8 w-8 rounded border ${selectedPiece === b ? "border-green-500 bg-slate-500" : "border-zinc-600 bg-slate-700"}`}
                  onClick={() => setSelectedPiece(b)}
                  title="Seleccionar pieza negra"
                >
                  <img src={PIECE_TO_IMG[b]} alt={b} className="h-6 w-6 mx-auto" />
                </button>
              </div>
            ))}
            <button className="h-8 px-2 rounded border border-zinc-700 bg-zinc-900 text-xs" onClick={() => setSelectedPiece(null)}>
              Borrar
            </button>
          </div>
        </div>
      )}

      <div ref={boardWrapRef} className="w-full max-w-full mx-auto overflow-hidden">
        <div className="relative rounded border border-zinc-600 overflow-hidden bg-zinc-950" style={{ width: `${boardWidth}px`, maxWidth: "100%" }}>
          <div id="pgn-viewer-board" ref={boardHostRef} className="w-full" />
          {!viewerReady && <div className="h-[260px] grid place-content-center text-xs text-zinc-400">Cargando visor pgn-viewer…</div>}
          {fitBoard && viewerReady && (
            <div className="absolute inset-0 grid grid-cols-8 grid-rows-8">
              {overlaySquares.map((sq) => (
                <button
                  key={sq}
                  className="border border-transparent hover:border-green-400/40"
                  onClick={() => onSetupSquareClick(sq)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (selectedPiece) {
                      setSquarePiece(sq, flipPieceColor(selectedPiece));
                    } else {
                      liftPiece(sq);
                    }
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      setSquarePiece(sq, null);
                    }
                  }}
                  title={`${sq} (clic coloca, derecho color opuesto, medio borra)`}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-2">
          <button className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700" onClick={resetBoard}>Inicio</button>
          {!fitBoard && <span className="text-[11px] text-zinc-400 self-center">Motor: {engineEnabled ? (engineReady ? "listo" : "iniciando...") : "apagado"}</span>}
        </div>

      <div className="mt-3 rounded bg-zinc-800/70 p-2">
        <div className="flex items-center justify-between">
          <strong className="text-xs">Evaluación Stockfish (Top 3)</strong>
          <span className="text-[11px] text-zinc-400">{analyzing ? "Analizando…" : "Listo"}</span>
        </div>
        <div className="mt-2 space-y-2">
          {analysisLines.map((line) => (
            <div key={line.multipv} className="text-xs rounded bg-zinc-900/70 p-2">
              <div className="font-semibold">#{line.multipv} Eval: {line.score}</div>
              <div className="mt-1 flex flex-wrap gap-1">
                {line.pv.slice(0, 16).map((m, idx) => (
                  <button key={`${line.multipv}-${idx}-${m}`} className="px-1.5 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700" onClick={() => applyPvUntil(line, idx)}>
                    {idx + 1}. {m}
                  </button>
                ))}
              </div>
            </div>
          ))}
          {analysisLines.length === 0 && <div className="text-xs text-zinc-400">{!engineEnabled ? "Stockfish está apagado." : (!engineReady ? "Stockfish iniciando..." : (fitBoard ? "Activa modo no edición para analizar." : "Sin líneas por ahora."))}</div>}
        </div>
      </div>

      <div className="mt-3 rounded bg-zinc-800/70 p-2">
        <button className="w-full text-left text-xs font-semibold" onClick={() => setOpenSession((v) => !v)}>
          {openSession ? "▼" : "▶"} Sesión PGN
        </button>
        {openSession && (
          <div className="mt-2">
            <textarea className="w-full min-h-[90px] bg-zinc-900 rounded p-2 text-xs" placeholder="Pega aquí un PGN" value={pgnInput} onChange={(e) => setPgnInput(e.target.value)} />
            <button className="mt-2 text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600" onClick={loadPgn}>Cargar PGN</button>
          </div>
        )}
      </div>

      <div className="mt-3 rounded bg-zinc-800/70 p-2">
        <button className="w-full text-left text-xs font-semibold" onClick={() => setOpenFixed((v) => !v)}>
          {openFixed ? "▼" : "▶"} Posición fija (FEN)
        </button>
        {openFixed && (
          <div className="mt-2">
            <input className="w-full bg-zinc-900 rounded p-2 text-xs" placeholder="FEN" value={fenInput} onChange={(e) => setFenInput(e.target.value)} />
          <button className="mt-2 text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600" onClick={loadFen}>Cargar FEN</button>
        </div>
      )}
      </div>

      <div className="mt-3 rounded bg-zinc-800/70 p-2">
        <button className="w-full text-left text-xs font-semibold" onClick={() => setOpenNotes((v) => !v)}>
          {openNotes ? "▼" : "▶"} Notas
        </button>
        {openNotes && (
          <div className="mt-2">
            <textarea className="w-full min-h-[90px] bg-zinc-900 rounded p-2 text-xs" placeholder="Notas de la sesión" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="mt-2 flex items-center gap-2">
              <button className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600" onClick={saveNotes}>Guardar notas</button>
              {notesStatus && <span className="text-[11px] text-zinc-400">{notesStatus}</span>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
