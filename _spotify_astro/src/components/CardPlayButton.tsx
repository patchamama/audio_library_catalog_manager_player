import { usePlayerStore } from '@/store/playerStore'
import { getPlayListInfoById } from "@/services/ApiService";
import { Pause, Play } from "@/icons/PlayerIcons"


export function CardPlayButton({id, size = 'small'}) {
  const {
    currentMusic,
    isPlaying,
    setIsPlaying,
    setCurrentMusic,
    setMobilePlayerVisible
  } = usePlayerStore(state => state)

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


  return (
    <button onClick={handleClick}
            className="card-play-button rounded-full text-black bg-green-500 p-4 hover:scale-105 transition hover:bg-green-400">
      {isPlayingPlaylist ? <Pause className={iconClassName}/> : <Play className={iconClassName}/>}
    </button>
  )
}
