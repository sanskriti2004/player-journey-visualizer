import { useEffect, useRef, useState } from 'react'

/** `resetKey` restarts playback state when the selection changes even if the duration doesn't. */
export function usePlayback(duration: number, resetKey: string) {
  const [time, setTimeState] = useState(duration)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(10)
  const timeRef = useRef(duration)

  const setTime = (t: number) => {
    timeRef.current = Math.max(0, Math.min(duration, t))
    setTimeState(timeRef.current)
  }

  useEffect(() => {
    timeRef.current = duration
    setTimeState(duration)
    setPlaying(false)
  }, [duration, resetKey])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last: number | null = null
    const tick = (now: number) => {
      const dt = last === null ? 0 : (now - last) / 1000
      last = now
      timeRef.current = Math.min(duration, timeRef.current + dt * speed)
      setTimeState(timeRef.current)
      if (timeRef.current >= duration) setPlaying(false)
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed, duration])

  const toggle = () => {
    if (!playing && timeRef.current >= duration) setTime(0)
    setPlaying((p) => !p)
  }

  return { time, playing, speed, setSpeed, toggle, seek: setTime, complete: time >= duration }
}
