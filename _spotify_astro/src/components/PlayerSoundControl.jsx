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

  const durationRaw = audio?.current?.duration ?? 0
  const duration = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 0
  const safeCurrentTime = Math.max(0, Math.min(currentTime || 0, duration || Math.max(currentTime || 0, 0)))

  const showHours = duration > 60

  const formatTime = time => {
    if (time == null) return showHours ? '0:00:00' : '0:00'
    const h = Math.floor(time / 3600)
    const m = Math.floor((time % 3600) / 60)
    const s = Math.floor(time % 60)
    if (showHours) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  const timeWidth = showHours ? 'w-16' : 'w-12'

  return (
    <div className="flex gap-x-2 md:gap-x-3 text-xs pt-1 md:pt-2 items-center w-full px-2 md:px-0">
      <span className={`opacity-50 ${timeWidth} text-right`}>{formatTime(currentTime)}</span>

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

      <span className={`opacity-50 ${timeWidth}`}>
        {duration ? formatTime(duration) : (showHours ? '0:00:00' : '0:00')}
      </span>
    </div>
  )
}
