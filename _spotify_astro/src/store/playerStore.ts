import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Playlist, Song } from "@/lib/types";

export interface CurrentMusic {
  playlist: Playlist | null;
  song: Song | null;
  songs: Song[];
}

export interface PlayerStore {
  isPlaying: boolean;
  isTrackLoading: boolean;
  isMobilePlayerVisible: boolean;
  shuffleMode: boolean;
  repeatAllMode: boolean;
  currentMusic: CurrentMusic;
  volume: number;
  queue: Song[];
  setVolume: (volume: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setShuffleMode: (enabled: boolean) => void;
  setRepeatAllMode: (enabled: boolean) => void;
  setMobilePlayerVisible: (visible: boolean) => void;
  setCurrentMusic: (currentMusic: CurrentMusic) => void;
  setTrackLoading: (loading: boolean) => void;
  addToQueue: (song: Song) => void;
  removeFromQueue: (index: number) => void;
  shiftQueue: () => Song | null;
  clearQueue: () => void;
}


export const usePlayerStore = create<PlayerStore>()(
  persist(
    (set) => ({
      isPlaying: false,
      isTrackLoading: false,
      isMobilePlayerVisible: true,
      shuffleMode: false,
      repeatAllMode: false,
      currentMusic: { playlist: null, song: null, songs: [] },
      volume: 0.5,
      queue: [],
      setVolume: (volume) => set({ volume }),
      setIsPlaying: (isPlaying) => set({ isPlaying }),
      setShuffleMode: (enabled) => set({ shuffleMode: enabled }),
      setRepeatAllMode: (enabled) => set({ repeatAllMode: enabled }),
      setMobilePlayerVisible: (visible) => set({ isMobilePlayerVisible: visible }),
      setCurrentMusic: (currentMusic) => {set({currentMusic})},
      setTrackLoading: (loading) => set({ isTrackLoading: loading }),
      addToQueue: (song) => set((state) => ({ queue: [...state.queue, song] })),
      removeFromQueue: (index) =>
        set((state) => ({
          queue: state.queue.filter((_, i) => i !== index),
        })),
      shiftQueue: () => {
        let next: Song | null = null;
        set((state) => {
          if (state.queue.length === 0) return state;
          next = state.queue[0];
          return { queue: state.queue.slice(1) };
        });
        return next;
      },
      clearQueue: () => set({ queue: [] }),
    }),
    {
      name: "player-store-v1",
      partialize: (state) => ({
        volume: state.volume,
        queue: state.queue,
      }),
    }
  )
);
