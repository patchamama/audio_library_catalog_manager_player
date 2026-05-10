import { usePlayerStore } from '@/store/playerStore'
import { getPlayListInfoById } from "@/services/ApiService";
import { Next, Pause, Play, Prev } from "@/icons/PlayerIcons"
import { useCurrentMusic } from "@/hooks/UseCurrentMusic";
import { normalizeSongMediaType } from "@/lib/media";


export function CardPlayButton({id, size = 'small'}) {
  const currentMusic = usePlayerStore(state => state.currentMusic);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const shuffleMode = usePlayerStore(state => state.shuffleMode);
  const repeatAllMode = usePlayerStore(state => state.repeatAllMode);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setShuffleMode = usePlayerStore(state => state.setShuffleMode);
  const setRepeatAllMode = usePlayerStore(state => state.setRepeatAllMode);
  const setCurrentMusic = usePlayerStore(state => state.setCurrentMusic);
  const setMobilePlayerVisible = usePlayerStore(state => state.setMobilePlayerVisible);
  const { getNextSong, getPreviousSong } = useCurrentMusic(currentMusic);

  const isPlayingPlaylist = isPlaying && currentMusic?.playlist?.id === id
  const isThisPlaylistInStore = currentMusic?.playlist?.id === id

  const handleClick = () => {
    if (isThisPlaylistInStore) {
      setIsPlaying(!isPlaying);
      setMobilePlayerVisible(true);
      return
    }

    getPlayListInfoById(id).then(data => {
      const {songs, playlist} = data
      setCurrentMusic({songs: songs, playlist: playlist, song: songs[0]})
    }).then(() => {
      setIsPlaying(true);
      setMobilePlayerVisible(true);
    })
  }

  const iconClassName = size === 'small' ? 'w-4 h-4' : 'w-5 h-5'
  const smallBtn = size === 'small' ? 'w-6 h-6 text-[10px]' : 'w-7 h-7 text-xs';

  const handleRandomPlay = () => {
    const enableShuffle = !shuffleMode;
    setShuffleMode(enableShuffle);
    if (!enableShuffle) return;
    if (isThisPlaylistInStore && currentMusic.songs.length > 0) {
      const pick = currentMusic.songs[Math.floor(Math.random() * currentMusic.songs.length)];
      if (pick) setCurrentMusic({ ...currentMusic, song: pick });
      setIsPlaying(true);
      setMobilePlayerVisible(true);
      return;
    }
    getPlayListInfoById(id).then(data => {
      const { songs, playlist } = data;
      const pick = songs[Math.floor(Math.random() * songs.length)] ?? songs[0];
      setCurrentMusic({ songs, playlist, song: pick });
    }).then(() => {
      setIsPlaying(true);
      setMobilePlayerVisible(true);
    });
  };

  const handleInfinitePlay = () => {
    const enableRepeat = !repeatAllMode;
    setRepeatAllMode(enableRepeat);
    if (!enableRepeat) return;
    if (isThisPlaylistInStore) {
      setIsPlaying(true);
      setMobilePlayerVisible(true);
      return;
    }
    handleClick();
  };

  const handlePrevSong = () => {
    if (isThisPlaylistInStore) {
      const prevSong = getPreviousSong();
      if (prevSong) {
        setCurrentMusic({ ...currentMusic, song: normalizeSongMediaType(prevSong) });
        setIsPlaying(true);
        setMobilePlayerVisible(true);
      }
      return;
    }
    getPlayListInfoById(id).then(data => {
      const { songs, playlist } = data;
      if (!songs?.length) return;
      const pick = songs[songs.length - 1];
      setCurrentMusic({ songs, playlist, song: normalizeSongMediaType(pick) });
      setIsPlaying(true);
      setMobilePlayerVisible(true);
    });
  };

  const handleNextSong = () => {
    if (isThisPlaylistInStore) {
      const nextSong = getNextSong();
      if (nextSong) {
        setCurrentMusic({ ...currentMusic, song: normalizeSongMediaType(nextSong) });
        setIsPlaying(true);
        setMobilePlayerVisible(true);
      }
      return;
    }
    getPlayListInfoById(id).then(data => {
      const { songs, playlist } = data;
      if (!songs?.length) return;
      const pick = songs.length > 1 ? songs[1] : songs[0];
      setCurrentMusic({ songs, playlist, song: normalizeSongMediaType(pick) });
      setIsPlaying(true);
      setMobilePlayerVisible(true);
    });
  };


  return (
    <div className="flex items-center gap-2">
      <button onClick={handleClick}
              className="card-play-button rounded-full text-black bg-green-500 p-4 hover:scale-105 transition hover:bg-green-400"
              title={isPlayingPlaylist ? 'Pausar' : 'Reproducir'}>
        {isPlayingPlaylist ? <Pause className={iconClassName}/> : <Play className={iconClassName}/>}
      </button>
      <button
        type="button"
        onClick={handleRandomPlay}
        title="Reproducir álbum en modo random"
        className={`${smallBtn} rounded-full grid place-content-center transition ${shuffleMode ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
      >
        ↭
      </button>
      <button
        type="button"
        onClick={handleInfinitePlay}
        title="Reproducción infinita del álbum"
        className={`${smallBtn} rounded-full grid place-content-center transition ${repeatAllMode ? 'bg-green-500 text-black' : 'bg-zinc-700 text-white hover:bg-zinc-600'}`}
      >
        ∞
      </button>
      <button
        type="button"
        onClick={handlePrevSong}
        title="Anterior"
        className={`${smallBtn} rounded-full grid place-content-center transition bg-zinc-700 text-white hover:bg-zinc-600 md:hidden`}
      >
        <Prev className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={handleNextSong}
        title="Siguiente"
        className={`${smallBtn} rounded-full grid place-content-center transition bg-zinc-700 text-white hover:bg-zinc-600 md:hidden`}
      >
        <Next className="w-3.5 h-3.5" />
      </button>
    </div>
  )
}
