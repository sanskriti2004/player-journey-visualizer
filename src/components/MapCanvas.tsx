import { useCallback, useEffect, useRef, useState } from 'react'
import { describeEvent, EVENT_GROUP, GROUP_STYLE, OUTCOME_LABEL, PATH_COLOR } from '../lib/events'
import { formatClock, shortId } from '../lib/format'
import { positionAt, samplesUntil } from '../lib/playback'
import type { EventGroup, GameEvent, Layers, MapInfo, Player } from '../types'

/** Logical map size; UV [0,1] maps to [0, MAP_UNITS] in both axes. */
const MAP_UNITS = 1024
const MIN_ZOOM = 0.6
const MAX_ZOOM = 14
const HIT_RADIUS = 10

export interface Journey {
  matchId: string
  player: Player
}

export const journeyKey = (j: Journey) => `${j.matchId}/${j.player.id}`

interface Props {
  map: MapInfo
  image: HTMLImageElement | null
  journeys: Journey[]
  layers: Layers
  time: number
  complete: boolean
  heat: HTMLCanvasElement | null
  focus: string | null
  aggregate: boolean
  onPick: (j: Journey, openMatch: boolean) => void
}

interface View {
  scale: number
  x: number
  y: number
}

interface Hit {
  x: number
  y: number
  journey: Journey
  event?: GameEvent
  head?: boolean
}

interface Tip {
  x: number
  y: number
  hit: Hit
}

const pathCache = new WeakMap<Player, Path2D>()

function fullPath(p: Player): Path2D {
  let path = pathCache.get(p)
  if (!path) {
    path = new Path2D()
    for (let i = 0; i < p.path.length; i += 3) {
      const x = p.path[i + 1] * MAP_UNITS
      const y = (1 - p.path[i + 2]) * MAP_UNITS
      if (i === 0) path.moveTo(x, y)
      else path.lineTo(x, y)
    }
    pathCache.set(p, path)
  }
  return path
}

function partialPath(p: Player, t: number): Path2D {
  const path = new Path2D()
  const n = samplesUntil(p.path, t)
  for (let i = 0; i < n; i++) {
    const x = p.path[i * 3 + 1] * MAP_UNITS
    const y = (1 - p.path[i * 3 + 2]) * MAP_UNITS
    if (i === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  const head = positionAt(p.path, t)
  if (head && n > 0) path.lineTo(head[0] * MAP_UNITS, (1 - head[1]) * MAP_UNITS)
  return path
}

function drawMarker(ctx: CanvasRenderingContext2D, group: EventGroup, x: number, y: number, k = 1) {
  const color = GROUP_STYLE[group].color
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'
  const stroke = (build: () => void, width: number) => {
    ctx.beginPath()
    build()
    ctx.strokeStyle = 'rgba(10,11,14,0.9)'
    ctx.lineWidth = width + 2.5
    ctx.stroke()
    ctx.strokeStyle = color
    ctx.lineWidth = width
    ctx.stroke()
  }
  switch (group) {
    case 'kill': {
      const r = 5.5 * k
      stroke(() => {
        ctx.moveTo(x - r, y); ctx.lineTo(x + r, y)
        ctx.moveTo(x, y - r); ctx.lineTo(x, y + r)
        ctx.moveTo(x + 3 * k, y); ctx.arc(x, y, 3 * k, 0, Math.PI * 2)
      }, 1.8)
      break
    }
    case 'death': {
      const r = 4.5 * k
      stroke(() => {
        ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r)
        ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r)
      }, 2.2)
      break
    }
    case 'storm': {
      const r = 6 * k
      ctx.beginPath()
      ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath()
      ctx.fillStyle = color
      ctx.fill()
      ctx.strokeStyle = 'rgba(10,11,14,0.9)'
      ctx.lineWidth = 1.5
      ctx.stroke()
      break
    }
    case 'loot': {
      const r = 3 * k
      ctx.fillStyle = 'rgba(10,11,14,0.85)'
      ctx.fillRect(x - r - 1, y - r - 1, 2 * r + 2, 2 * r + 2)
      ctx.fillStyle = color
      ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
      break
    }
  }
}

const MARKER_ORDER: EventGroup[] = ['loot', 'kill', 'death', 'storm']

export default function MapCanvas({ map, image, journeys, layers, time, complete, heat, focus, aggregate, onPick }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  const [view, setView] = useState<View>({ scale: 1, x: 0, y: 0 })
  const [tip, setTip] = useState<Tip | null>(null)
  const hits = useRef<Hit[]>([])
  const drag = useRef<{ x: number; y: number; moved: boolean } | null>(null)

  const fit = useCallback(() => {
    const { w, h } = size
    if (!w || !h) return
    const scale = (Math.min(w, h) / MAP_UNITS) * 0.96
    setView({ scale, x: (w - MAP_UNITS * scale) / 2, y: (h - MAP_UNITS * scale) / 2 })
  }, [size])

  useEffect(() => {
    const el = wrapRef.current!
    const ro = new ResizeObserver(([entry]) => {
      setSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(fit, [fit, map.id])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !size.w) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.round(size.w * dpr)
    canvas.height = Math.round(size.h * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = '#0b0c0f'
    ctx.fillRect(0, 0, size.w, size.h)

    const { scale, x: ox, y: oy } = view
    const toScreen = (u: number, v: number): [number, number] => [ox + u * MAP_UNITS * scale, oy + (1 - v) * MAP_UNITS * scale]
    const mapTransform = () => ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy)
    const screenTransform = () => ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    mapTransform()
    if (image) {
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(image, 0, 0, MAP_UNITS, MAP_UNITS)
    }
    if (heat) {
      ctx.globalAlpha = 0.85
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(heat, 0, 0, MAP_UNITS, MAP_UNITS)
      ctx.globalAlpha = 1
    }

    const visible = journeys.filter((j) => (j.player.bot ? layers.bots : layers.humans))
    const ordered = [...visible].sort((a, b) => Number(!a.player.bot) - Number(!b.player.bot))
    const baseWidth = aggregate ? 1.1 : 2
    const baseAlpha = (aggregate ? 0.32 : 0.9) * (heat ? 0.4 : 1)
    const markerSize = aggregate ? 0.8 : 1.15
    const markerAlpha = aggregate && heat ? 0.45 : 1
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    for (const j of ordered) {
      const key = journeyKey(j)
      const focused = focus === key
      const dimmed = focus !== null && !focused
      ctx.strokeStyle = j.player.bot ? PATH_COLOR.bot : PATH_COLOR.human
      ctx.globalAlpha = dimmed ? Math.min(baseAlpha, 0.18) : focused ? 1 : baseAlpha
      ctx.lineWidth = (focused ? 3.2 : baseWidth) / scale
      ctx.setLineDash(j.player.bot ? [5 / scale, 4 / scale] : [])
      ctx.stroke(complete ? fullPath(j.player) : partialPath(j.player, time))
    }
    ctx.globalAlpha = 1
    ctx.setLineDash([])

    screenTransform()
    const nextHits: Hit[] = []
    const inView = (x: number, y: number) => x > -10 && y > -10 && x < size.w + 10 && y < size.h + 10
    for (const group of MARKER_ORDER) {
      if (!layers[group]) continue
      for (const j of ordered) {
        const dimmed = focus !== null && focus !== journeyKey(j)
        for (const e of j.player.events) {
          if (EVENT_GROUP[e[3]] !== group || e[0] > time) continue
          const [x, y] = toScreen(e[1], e[2])
          if (!inView(x, y)) continue
          ctx.globalAlpha = dimmed ? 0.3 : markerAlpha
          drawMarker(ctx, group, x, y, markerSize)
          nextHits.push({ x, y, journey: j, event: e })
        }
      }
    }
    ctx.globalAlpha = 1

    if (!complete) {
      for (const j of ordered) {
        const pos = positionAt(j.player.path, time)
        if (!pos) continue
        const [x, y] = toScreen(pos[0], pos[1])
        const focused = focus === journeyKey(j)
        ctx.beginPath()
        ctx.arc(x, y, focused ? 6.5 : aggregate ? 3.5 : 5, 0, Math.PI * 2)
        ctx.fillStyle = j.player.bot ? PATH_COLOR.bot : PATH_COLOR.human
        ctx.fill()
        ctx.lineWidth = 2
        ctx.strokeStyle = focused ? '#ffffff' : 'rgba(10,11,14,0.9)'
        ctx.stroke()
        nextHits.push({ x, y, journey: j, head: true })
      }
    }
    hits.current = nextHits
  }, [size, view, image, heat, journeys, layers, time, complete, focus, aggregate])

  const hitAt = (x: number, y: number): Hit | null => {
    let best: Hit | null = null
    let bestD = HIT_RADIUS * HIT_RADIUS
    for (const h of hits.current) {
      const d = (h.x - x) ** 2 + (h.y - y) ** 2
      if (d <= bestD) {
        best = h
        bestD = d
      }
    }
    return best
  }

  const zoomAt = useCallback((factor: number, cx: number, cy: number) => {
    setView((v) => {
      const fitScale = (Math.min(size.w, size.h) / MAP_UNITS) * 0.96
      const scale = Math.min(fitScale * MAX_ZOOM, Math.max(fitScale * MIN_ZOOM, v.scale * factor))
      const k = scale / v.scale
      return { scale, x: cx - (cx - v.x) * k, y: cy - (cy - v.y) * k }
    })
  }, [size])

  useEffect(() => {
    const el = canvasRef.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const r = el.getBoundingClientRect()
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  const local = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect()
    return [e.clientX - r.left, e.clientY - r.top] as const
  }

  const onPointerDown = (e: React.PointerEvent) => {
    canvasRef.current!.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (d) {
      const dx = e.clientX - d.x
      const dy = e.clientY - d.y
      if (d.moved || Math.abs(dx) + Math.abs(dy) > 3) {
        d.moved = true
        d.x = e.clientX
        d.y = e.clientY
        setView((v) => ({ ...v, x: v.x + dx, y: v.y + dy }))
        setTip(null)
        return
      }
    }
    const [x, y] = local(e)
    const hit = hitAt(x, y)
    setTip(hit ? { x, y, hit } : null)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const d = drag.current
    drag.current = null
    if (d?.moved) return
    const [x, y] = local(e)
    const hit = hitAt(x, y)
    if (hit) onPick(hit.journey, aggregate)
  }

  return (
    <div className="map-wrap" ref={wrapRef}>
      <canvas
        ref={canvasRef}
        className="map-canvas"
        style={{ cursor: tip ? 'pointer' : drag.current?.moved ? 'grabbing' : 'grab' }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => setTip(null)}
        onDoubleClick={(e) => {
          const [x, y] = local(e as unknown as React.PointerEvent)
          zoomAt(2, x, y)
        }}
        aria-label={`${map.name} minimap with player journeys`}
      />
      {!image && <div className="map-loading">Loading minimap…</div>}
      <div className="zoom-controls">
        <button onClick={() => zoomAt(1.5, size.w / 2, size.h / 2)} aria-label="Zoom in">+</button>
        <button onClick={() => zoomAt(1 / 1.5, size.w / 2, size.h / 2)} aria-label="Zoom out">−</button>
        <button onClick={fit} aria-label="Fit map" title="Fit map">⤢</button>
      </div>
      {tip && <Tooltip tip={tip} aggregate={aggregate} bounds={size} />}
    </div>
  )
}

function Tooltip({ tip, aggregate, bounds }: { tip: Tip; aggregate: boolean; bounds: { w: number; h: number } }) {
  const { journey, event } = tip.hit
  const p = journey.player
  const left = Math.min(tip.x + 14, bounds.w - 250)
  const top = Math.min(tip.y + 14, bounds.h - 110)
  return (
    <div className="tooltip" style={{ left, top }}>
      <div className="tooltip-title">
        {event ? (
          <>
            <span className="swatch" style={{ background: GROUP_STYLE[EVENT_GROUP[event[3]]].color }} />
            {describeEvent(event[3], p.bot)}
          </>
        ) : (
          <>{p.bot ? 'Bot' : 'Human player'} — current position</>
        )}
      </div>
      <div className="tooltip-row">
        <span>{p.bot ? 'Bot' : 'Player'}</span>
        <code>{p.bot ? p.id : shortId(p.id)}</code>
      </div>
      {event && (
        <div className="tooltip-row">
          <span>Match time</span>
          <code>{formatClock(event[0])}</code>
        </div>
      )}
      <div className="tooltip-row">
        <span>Outcome</span>
        <span>{OUTCOME_LABEL[p.outcome]}</span>
      </div>
      <div className="tooltip-hint">{aggregate ? `Click to open match ${shortId(journey.matchId)}` : 'Click to highlight this journey'}</div>
    </div>
  )
}
