import { useEffect, useRef } from 'react'
import { EVENT_GROUP, GROUP_STYLE } from '../lib/events'
import { formatClock } from '../lib/format'
import type { EventGroup, Layers } from '../types'
import type { Journey } from './MapCanvas'

export const SPEEDS = [1, 5, 10, 30]

interface Props {
  journeys: Journey[]
  layers: Layers
  time: number
  duration: number
  playing: boolean
  speed: number
  onTime: (t: number) => void
  onPlay: () => void
  onSpeed: (s: number) => void
}

const STRIP_GROUPS: EventGroup[] = ['kill', 'death', 'storm']
const BINS = 160

export default function Timeline({ journeys, layers, time, duration, playing, speed, onTime, onPlay, onSpeed }: Props) {
  const stripRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = stripRef.current
    if (!canvas) return
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1
    canvas.width = w * dpr
    canvas.height = h * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.clearRect(0, 0, w, h)
    if (!duration) return
    const counts: Record<string, number[]> = {}
    for (const g of STRIP_GROUPS) counts[g] = new Array(BINS).fill(0)
    for (const j of journeys) {
      if (j.player.bot ? !layers.bots : !layers.humans) continue
      for (const e of j.player.events) {
        const g = EVENT_GROUP[e[3]]
        if (!counts[g] || !layers[g]) continue
        counts[g][Math.min(BINS - 1, Math.floor((e[0] / duration) * BINS))]++
      }
    }
    const max = Math.max(1, ...STRIP_GROUPS.flatMap((g) => counts[g]))
    const bw = w / BINS
    const rowH = h / STRIP_GROUPS.length
    STRIP_GROUPS.forEach((g, row) => {
      ctx.fillStyle = GROUP_STYLE[g].color
      counts[g].forEach((c, i) => {
        if (!c) return
        const bh = Math.max(2, Math.sqrt(c / max) * (rowH - 2))
        ctx.fillRect(i * bw + 0.5, row * rowH + (rowH - bh), Math.max(1, bw - 1), bh)
      })
    })
  }, [journeys, layers, duration])

  const pct = duration ? (time / duration) * 100 : 0

  return (
    <div className="timeline">
      <button className="play" onClick={onPlay} aria-label={playing ? 'Pause' : 'Play'}>
        {playing ? '❚❚' : '▶'}
      </button>
      <div className="timeline-track">
        <canvas ref={stripRef} className="timeline-strip" aria-hidden />
        <input
          type="range"
          min={0}
          max={duration}
          step={1}
          value={Math.min(time, duration)}
          onChange={(e) => onTime(Number(e.target.value))}
          style={{ '--pct': `${pct}%` } as React.CSSProperties}
          aria-label="Match time"
        />
      </div>
      <div className="clock">
        <strong>{formatClock(time)}</strong>
        <span> / {formatClock(duration)}</span>
      </div>
      <div className="speed" role="group" aria-label="Playback speed">
        {SPEEDS.map((s) => (
          <button key={s} className={s === speed ? 'active' : ''} onClick={() => onSpeed(s)}>
            {s}×
          </button>
        ))}
      </div>
    </div>
  )
}
