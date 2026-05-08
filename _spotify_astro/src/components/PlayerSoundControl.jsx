import {useEffect, useState} from "react";
import {Slider} from "@/components/Slider";

export const PlayerSoundControl = ({ audio }) => {
  const [currentTime, setCurrentTime] = useState(0)

  useEffect(() => {
    const id = window.setInterval(() => {
      if (!audio?.current) return;
      setCurrentTime(audio.current.currentTime || 0);
    }, 250);
    return () => {
      window.clearInterval(id);
    }
  }, [audio])

  const formatTime = time => {
    if (time == null) return `0:00`

    const seconds = Math.floor(time % 60)
    const minutes = Math.floor(time / 60)

    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  const durationRaw = audio?.current?.duration ?? 0
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 0
  const safeCurrentTime = Math.max(0, Math.min(currentTime || 0, duration || Math.max(currentTime || 0, 0)))

  return (
    <div className="flex gap-x-2 md:gap-x-3 text-xs pt-1 md:pt-2 items-center w-full px-2 md:px-0">
      <span className="opacity-50 w-12 text-right">{formatTime(currentTime)}</span>

      <Slider
        value={[safeCurrentTime]}
        max={duration || Math.max(safeCurrentTime, 1)}
        min={0}
        className="flex-1"
        onValueChange={(value) => {
          const [newCurrentTime] = value
          if (!Number.isFinite(newCurrentTime)) return
          audio.current.currentTime = newCurrentTime
          setCurrentTime(newCurrentTime)
        }}
      />

      <span className="opacity-50 w-12">
        {duration ? formatTime(duration) : '0:00'}
      </span>
    </div>
  )
}
