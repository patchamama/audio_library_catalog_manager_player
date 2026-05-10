import { Next, Pause, Play, Prev } from "@/icons/PlayerIcons";
import { useCurrentMusic } from "@/hooks/UseCurrentMusic";
import { usePlayerStore } from "@/store/playerStore";

interface Props {
  onSeekBack?: () => void;
  onSeekForward?: () => void;
  onNextSong?: () => void;
  onPrevSong?: () => void;
}

export function PlayerControlButtonBar({ onSeekBack, onSeekForward, onNextSong, onPrevSong }: Props) {
  const currentMusic = usePlayerStore(state => state.currentMusic);
  const isPlaying = usePlayerStore(state => state.isPlaying);
  const setIsPlaying = usePlayerStore(state => state.setIsPlaying);
  const setCurrentMusic = usePlayerStore(state => state.setCurrentMusic);
  const { getNextSong, getPreviousSong } = useCurrentMusic(currentMusic);


  const onPlayPause = () => {
    if (currentMusic.song === null) return;
    setIsPlaying(!isPlaying);
  }


  const onNextSongDefault = () => {
    const nextSong = getNextSong();
    if (nextSong) {
      setCurrentMusic({ ...currentMusic, song: nextSong });
    }
  }

  const onPrevSongDefault = () => {
    const prevSong = getPreviousSong();
    if (prevSong) {
      setCurrentMusic({ ...currentMusic, song: prevSong });
    }
  }

  return (
    <div className="flex justify-center flex-row flex-nowrap items-center gap-4">
      <button className="hover:scale-110 text-xs opacity-90" onClick={onSeekBack} title="Retroceder 5 segundos">
        -5s
      </button>
      <button className="hover:scale-110" onClick={onPrevSong ?? onPrevSongDefault} title="Previous song">
        <Prev/>
      </button>
      <button className="bg-white text-black rounded-full p-2 hover:scale-110" onClick={onPlayPause}>
        {isPlaying ? <Pause/> : <Play/>}
      </button>
      <button className="hover:scale-110" onClick={onNextSong ?? onNextSongDefault} title="Next song">
        <Next/>
      </button>
      <button className="hover:scale-110 text-xs opacity-90" onClick={onSeekForward} title="Adelantar 5 segundos">
        +5s
      </button>
    </div>
  );
}
