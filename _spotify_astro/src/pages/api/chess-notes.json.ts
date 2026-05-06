import type { APIRoute } from "astro";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const DB_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "chess-notes.sqlite");

const ensureDb = () => {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS chess_notes (
      user_id TEXT NOT NULL,
      context_key TEXT NOT NULL,
      note TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, context_key)
    );
  `);
  return db;
};

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  const user = (url.searchParams.get("user") || "").trim();
  const context = (url.searchParams.get("context") || "default").trim();
  if (!user) return new Response(JSON.stringify({ note: "" }), { headers: { "content-type": "application/json" } });

  const db = ensureDb();
  const row = db.prepare("SELECT note FROM chess_notes WHERE user_id = ? AND context_key = ?").get(user, context) as { note?: string } | undefined;
  db.close();
  return new Response(JSON.stringify({ note: row?.note || "" }), { headers: { "content-type": "application/json" } });
};

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const user = String(body?.user || "").trim();
  const context = String(body?.context || "default").trim();
  const note = String(body?.note || "");

  if (!user) {
    return new Response(JSON.stringify({ ok: false, error: "missing user" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const db = ensureDb();
  db.prepare(`
    INSERT INTO chess_notes (user_id, context_key, note, updated_at)
    VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, context_key) DO UPDATE SET
      note = excluded.note,
      updated_at = CURRENT_TIMESTAMP
  `).run(user, context, note);
  db.close();

  return new Response(JSON.stringify({ ok: true }), { headers: { "content-type": "application/json" } });
};

