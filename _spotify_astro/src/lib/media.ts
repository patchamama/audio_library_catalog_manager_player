import type { Song } from "@/lib/types";

export const isVideoSong = (song: Song) =>
  song.mediaType === "video" || song.url.toLowerCase().endsWith(".mp4");

export const normalizeSongMediaType = (song: Song): Song => ({
  ...song,
  mediaType: isVideoSong(song) ? "video" : "audio",
});
