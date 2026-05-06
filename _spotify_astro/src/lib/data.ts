import fs from "node:fs";
import path from "node:path";
import { colors } from "./colors";
import type { Playlist, Song } from "./types";

const MEDIA_ROOT = path.resolve(process.cwd(), "..");
const MEDIA_BASE = "/_audios";
const DEFAULT_COVER = "/_audios/spotify/default-cover.svg";
const IGNORE = new Set([
  ".git",
  ".agents",
  "_spotify_astro",
  "node_modules",
  "dist",
  "config",
  "css",
  "img",
  "font",
  "lib",
  "backend.patchamama.com",
]);
const COVER_CANDIDATES = ["cover.jpg", "cover.jpeg", "cover.png", "folder.jpg", "Folder.jpg", "AlbumArtSmall.jpg"];
const AUDIO_EXTS = new Set([".mp3", ".mp4"]);
const colorList = Object.values(colors);

const safeReaddir = (p: string) => {
  try { return fs.readdirSync(p, { withFileTypes: true }); } catch { return []; }
};

const findCover = (albumPath: string, albumName: string) => {
  for (const c of COVER_CANDIDATES) {
    const f = path.join(albumPath, c);
    if (fs.existsSync(f)) return `${MEDIA_BASE}/${encodePath(albumName, c)}`;
  }
  const anyImg = safeReaddir(albumPath).find((d) => d.isFile() && /\.(jpg|jpeg|png|webp)$/i.test(d.name));
  return anyImg ? `${MEDIA_BASE}/${encodePath(albumName, anyImg.name)}` : DEFAULT_COVER;
};

const splitAuthorTitle = (albumName: string) => {
  const m = albumName.match(/^\s*(.*?)\s*-\s*(.+)$/);
  if (!m) return { author: "Unknown", title: albumName.trim() };
  const author = (m[1] || "").trim() || "Unknown";
  const title = (m[2] || "").trim() || albumName.trim();
  return { author, title };
};

const stripExt = (fileName: string) => fileName.replace(/\.(mp3|mp4|m4a|webm|ogg)$/i, "");
const encodePath = (...parts: string[]) => parts.map((p) => encodeURIComponent(p)).join("/");

const hasPlayableFiles = (albumPath: string) =>
  safeReaddir(albumPath).some((f) => f.isFile() && AUDIO_EXTS.has(path.extname(f.name).toLowerCase()));

const albumDirs = safeReaddir(MEDIA_ROOT)
  .filter((d) => d.isDirectory() && !d.name.startsWith(".") && !IGNORE.has(d.name))
  .filter((d) => hasPlayableFiles(path.join(MEDIA_ROOT, d.name)))
  .map((d) => d.name)
  .sort((a, b) => a.localeCompare(b, "es"));

export const playlists: Playlist[] = albumDirs.map((album, idx) => ({
  id: `album-${idx + 1}`,
  albumId: idx + 1,
  folderName: album,
  title: splitAuthorTitle(album).title,
  color: colorList[idx % colorList.length],
  cover: findCover(path.join(MEDIA_ROOT, album), album),
  artists: [splitAuthorTitle(album).author],
}));

export const allPlaylists = playlists;
export const morePlaylists: Playlist[] = [];
export const sidebarPlaylists = playlists.slice(0, 120);

export const songs: Song[] = playlists.flatMap((playlist) => {
  const albumPath = path.join(MEDIA_ROOT, playlist.folderName);
  const files = safeReaddir(albumPath)
    .filter((f) => f.isFile() && AUDIO_EXTS.has(path.extname(f.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));

  return files.map((f, i) => ({
    id: i + 1,
    albumId: playlist.albumId,
    title: stripExt(f.name),
    mediaType: path.extname(f.name).toLowerCase() === ".mp4" ? "video" : "audio",
    image: playlist.cover,
    artists: playlist.artists,
    album: playlist.title,
    duration: "--:--",
    url: `${MEDIA_BASE}/${encodePath(playlist.folderName, f.name)}`,
  }));
});
