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
  youtubeCount?: number;
  hasYoutube?: boolean;
}

export interface Song {
  id: number;
  albumId: number;
  title: string;
  mediaType: "audio" | "video";
  youtubeId?: string | null;
  image: string;
  artists: string[];
  album: string;
  duration: string;
  url: string;
}
