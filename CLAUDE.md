# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Spotify-style audiobook/video player. Static site built with Astro + React + Tailwind + Zustand, served from `/_audios/spotify/`. Source lives in `_spotify_astro/`, build output goes to `spotify/`.

`index.php` is just a redirect to `/_audios/spotify/`.

## Commands

```bash
cd _spotify_astro

# Dev server
npm run dev          # or: npx astro dev

# Production build → outputs to ../spotify/
bash build-prod.sh   # runs: ASTRO_TELEMETRY_DISABLED=1 npm run build
```

No test suite. No linter configured.

## Architecture

### Data flow (build-time)

`src/lib/data.ts` reads the filesystem at **build time** (Node.js `fs`), scanning `../_audios/` for album folders. Each folder with `.mp3` or `.mp4` files becomes a `Playlist`. Each media file becomes a `Song`. Cover art is resolved from `cover.jpg`, `cover.jpeg`, `folder.jpg`, etc.

- `IGNORE` set in `data.ts` controls which folders are skipped (e.g. `_spotify_astro`, `.git`, `config`)
- `AUDIO_EXTS` controls which file extensions are treated as media (`.mp3`, `.mp4`)
- `Song.mediaType` is `"video"` for `.mp4`, `"audio"` for everything else
- The full playlist/song list is baked into `spotify/api/get-info-playlist.json` at build time — no runtime server needed

### Runtime data access

`ApiService.ts` fetches `/_audios/spotify/api/get-info-playlist.json` at runtime. This is the only API call. Player components filter the cached JSON to find playlists/songs by ID.

### State management

Zustand store at `src/store/playerStore.ts`:
- `currentMusic`: active `{ playlist, song, songs }`
- `isPlaying`, `volume`, `queue`
- Persisted to `localStorage` key `player-store-v1` (only `volume` and `queue`)
- Player also persists state to `localStorage` keys `player:state`, `player:activeAlbum`, `player:activeSong`, `player:volume` for session resume on reload

### Component map

| File | Role |
|------|------|
| `Player.jsx` | Bottom player bar. Owns `<audio>` and `<video>` refs. Controls playback, video modal visibility, session persistence |
| `MusicsTable.tsx` | Song list with search/filter, duration loading, add-to-queue button |
| `MusicsTablePlay.tsx` | Play/pause icon inside the song row |
| `CardPlayButton.tsx` | Big play button on album header |
| `PlayerControlButtonBar.tsx` | Prev/next/play controls |
| `PlayerSoundControl.jsx` | Seek bar |
| `PlayerVolumeControl.jsx` | Volume slider |
| `SidebarLibrary.tsx` | Left sidebar album list |
| `QueuePanel.tsx` | Queue panel |
| `AlbumBrowser.tsx` | Album grid on home page |

### Video playback

`Player.jsx` keeps both `<audio ref={audioRef}>` and `<video ref={videoRef}>` mounted. `getMediaRef(song)` returns the right ref based on `song.mediaType`. The video modal is shown/hidden via `showVideoModal` state — it is set to `true` when a video song becomes current and `false` via the "Cerrar" button. The video element is never unmounted; only its CSS class switches between `fixed ...` and `hidden`.

### Album folder naming convention

`src/lib/data.ts` parses `"Author - Title"` → `{ author, title }` via `splitAuthorTitle()`. Folders not matching this pattern get `author: "Unknown"`.

### Build output

`astro.config.mjs`:
- `base: '/_audios/spotify'` — all asset paths prefixed with this
- `outDir: '../spotify'` — build goes directly to the served directory
- `output: 'static'` — no SSR, fully static

To deploy: run `bash build-prod.sh` inside `_spotify_astro/`. No copy step needed.
