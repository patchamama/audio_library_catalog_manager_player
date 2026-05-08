import type { colors } from "./colors";

export interface Playlist {
  id: string;
  albumId: number;
  folderName: string;
  title: string;
  color: (typeof colors)[keyof typeof colors];
  cover: string;
  artists: string[];
  songCount?: number;
}

export interface Song {
  id: number;
  albumId: number;
  title: string;
  mediaType: "audio" | "video";
  image: string;
  artists: string[];
  album: string;
  duration: string;
  url: string;
}
