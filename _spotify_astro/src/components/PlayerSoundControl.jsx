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

  const duration = audio?.current?.duration ?? 0

  return (
    <div className="flex gap-x-2 md:gap-x-3 text-xs pt-1 md:pt-2 items-center w-full px-2 md:px-0">
      <span className="opacity-50 w-12 text-right">{formatTime(currentTime)}</span>

      <Slider
        value={[currentTime]}
        max={audio?.current?.duration ?? 0}
        min={0}
        className="w-[44vw] md:w-[400px]"
        onValueChange={(value) => {
          const [newCurrentTime] = value
          audio.current.currentTime = newCurrentTime
        }}
      />

      <span className="opacity-50 w-12">
        {duration ? formatTime(duration) : '0:00'}
      </span>
    </div>
  )
}
