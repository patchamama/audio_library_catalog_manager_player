import type { Song } from "@/lib/types"
import { Play, Pause } from "@/icons/PlayerIcons";
import { usePlayerStore, type CurrentMusic } from "@/store/playerStore.ts";
import { getPlayListInfoById } from "@/services/ApiService";
import { normalizeSongMediaType } from "@/lib/media";

interface Props {
  song: Song
  isCurrentSong: boolean
}


const isNewSongOfAnotherPlaylist = (currentMusic: CurrentMusic, song: Song) => {
  return currentMusic.playlist?.id != song.albumId
}


const setNewCurrentMusic = (
  song: Song,
  setIsPlaying: (isPlaying: boolean) => void,
  setCurrentMusic: (currentMusic: CurrentMusic) => void,
  setMobilePlayerVisible: (visible: boolean) => void): void => {
  getPlayListInfoById(song.albumId).then(data => {
    const {songs, playlist} = data
    setCurrentMusic({songs: songs.map(normalizeSongMediaType), playlist: playlist, song: normalizeSongMediaType(song)})
  }).then(() => {
    setIsPlaying(true)
    setMobilePlayerVisible(true)
  });
}

export const MusicsTablePlay = ({song, isCurrentSong}: Props) => {
  const {
    currentMusic,
    isPlaying,
    setIsPlaying,
    setCurrentMusic,
    setTrackLoading,
    setMobilePlayerVisible
  } = usePlayerStore(state => state)

  const isCurrentSongRunning = (song: Song) => {
    return (currentMusic.song?.id == song.id)
      && (currentMusic.playlist?.albumId == song.albumId)
      && isPlaying
  }


  const handleClick = (song: Song) => {
    const normalizedSong = normalizeSongMediaType(song);
    setTrackLoading(true)
    if (isCurrentSongRunning(normalizedSong)) {
      setIsPlaying(false)
      setTrackLoading(false)
      setMobilePlayerVisible(true)
      return
    }

    if (isNewSongOfAnotherPlaylist(currentMusic, normalizedSong)) {
      setNewCurrentMusic(normalizedSong, setIsPlaying, setCurrentMusic, setMobilePlayerVisible)
      return
    }

    // the playlist is the same, but the song is different
    if (currentMusic.song?.id !== normalizedSong.id) {
      setCurrentMusic({songs: currentMusic.songs.map(normalizeSongMediaType), playlist: currentMusic.playlist, song: normalizedSong})
    }
    setIsPlaying(true)
    setMobilePlayerVisible(true)
  }


  const className = "hover:scale-125"
  return (
    <button className="text-white" onClick={() => handleClick(song)}>
      {isCurrentSongRunning(song) ? <Pause className={className}/> : <Play className={className}/>}
    </button>
  )
}
