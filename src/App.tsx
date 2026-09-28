import { useCallback, useEffect, useMemo, useState } from 'react'
import LayerPanel from './components/LayerPanel'
import MapCanvas, { journeyKey, type Journey } from './components/MapCanvas'
import Sidebar from './components/Sidebar'
import Timeline from './components/Timeline'
import { imageUrl, loadManifest, loadMapData } from './lib/data'
import { EVENT_GROUP } from './lib/events'
import { formatClock, formatDay, shortId } from './lib/format'
import { densityGrid, renderHeatmap } from './lib/heatmap'
import { readUrlState, writeUrlState } from './lib/urlState'
import { usePlayback } from './lib/usePlayback'
import type { HeatmapMode, Layers, Manifest, MapData } from './types'

const DEFAULT_LAYERS: Layers = { humans: true, bots: true, kill: true, death: true, storm: true, loot: false }
const initialUrl = readUrlState()

export default function App() {
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mapId, setMapId] = useState(initialUrl.map ?? 'AmbroseValley')
  const [days, setDays] = useState<string[]>(initialUrl.days)
  const [matchId, setMatchId] = useState<string | null>(initialUrl.match)
  const [layers, setLayers] = useState<Layers>(DEFAULT_LAYERS)
  const [heat, setHeat] = useState<HeatmapMode>(initialUrl.heat)
  const [heatRadius, setHeatRadius] = useState(3)
  const [focus, setFocus] = useState<string | null>(null)
  const [mapData, setMapData] = useState<{ id: string; data: MapData } | null>(null)
  const [image, setImage] = useState<{ id: string; img: HTMLImageElement } | null>(null)

  useEffect(() => {
    loadManifest()
      .then((m) => {
        setManifest(m)
        setMapId((cur) => (m.maps.some((x) => x.id === cur) ? cur : m.maps[0].id))
      })
      .catch((e: Error) => setError(e.message))
  }, [])

  useEffect(() => {
    const onHash = () => {
      const next = readUrlState()
      if (next.map) setMapId(next.map)
      setDays(next.days)
      setMatchId(next.match)
      setHeat(next.heat)
      setFocus(null)
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const map = manifest?.maps.find((m) => m.id === mapId) ?? null

  useEffect(() => {
    if (!map) return
    let live = true
    loadMapData(map.id)
      .then((data) => live && setMapData({ id: map.id, data }))
      .catch((e: Error) => setError(e.message))
    const img = new Image()
    img.onload = () => live && setImage({ id: map.id, img })
    img.src = imageUrl(map.image)
    return () => {
      live = false
    }
  }, [map])

  const matchCountByMap = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const m of manifest?.matches ?? []) if (!days.length || days.includes(m.day)) counts[m.map] = (counts[m.map] ?? 0) + 1
    return counts
  }, [manifest, days])

  const matches = useMemo(
    () => (manifest?.matches ?? []).filter((m) => m.map === mapId && (!days.length || days.includes(m.day))),
    [manifest, mapId, days],
  )

  const selected = matchId ? (matches.find((m) => m.id === matchId) ?? null) : null

  useEffect(() => {
    if (manifest && matchId && !selected) setMatchId(null)
  }, [manifest, matchId, selected])

  useEffect(() => {
    writeUrlState({ map: mapId, days, match: selected?.id ?? null, heat })
  }, [mapId, days, selected, heat])

  const data = mapData?.id === mapId ? mapData.data : null

  const journeys = useMemo<Journey[]>(() => {
    if (!data) return []
    const ids = selected ? [selected.id] : matches.map((m) => m.id)
    return ids.flatMap((id) => (data.matches[id]?.players ?? []).map((player) => ({ matchId: id, player })))
  }, [data, selected, matches])

  const duration = selected ? selected.duration : Math.max(0, ...matches.map((m) => m.duration))
  const playback = usePlayback(duration, `${mapId}|${days.join()}|${selected?.id ?? ''}`)

  const heatCanvas = useMemo(() => {
    if (heat === 'off' || !journeys.length) return null
    const points: [number, number][] = []
    for (const { player } of journeys) {
      if (player.bot ? !layers.bots : !layers.humans) continue
      if (heat === 'traffic') {
        for (let i = 0; i < player.path.length; i += 3) points.push([player.path[i + 1], player.path[i + 2]])
      } else {
        for (const e of player.events) if (EVENT_GROUP[e[3]] === heat) points.push([e[1], e[2]])
      }
    }
    return points.length ? renderHeatmap(densityGrid(points, heatRadius)) : null
  }, [heat, heatRadius, journeys, layers.bots, layers.humans])

  const selectMap = (id: string) => {
    setMapId(id)
    setMatchId(null)
    setFocus(null)
  }

  const selectMatch = (id: string | null) => {
    setMatchId(id)
    setFocus(null)
  }

  const onPick = useCallback((j: Journey, openMatch: boolean) => {
    const key = journeyKey(j)
    if (openMatch) {
      setMatchId(j.matchId)
      setFocus(key)
    } else {
      setFocus((f) => (f === key ? null : key))
    }
  }, [])

  const { toggle, seek, time } = playback
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      if (t instanceof HTMLInputElement || t instanceof HTMLSelectElement) return
      if (e.code === 'Space' && t instanceof HTMLButtonElement) return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowRight') seek(time + 10)
      else if (e.code === 'ArrowLeft') seek(time - 10)
      else if (e.code === 'Escape') setFocus(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggle, seek, time])

  if (error) return <div className="fullscreen-msg">Couldn't load data: {error}</div>
  if (!manifest || !map) return <div className="fullscreen-msg">Loading telemetry…</div>

  const stats = summarize(journeys, selected ? ['Length', formatClock(selected.duration)] : ['Matches', matches.length])

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" />
          <div>
            <h1>Player Journeys</h1>
            <p>LILA BLACK · level design telemetry</p>
          </div>
        </div>
        <div className="context">
          <strong>{map.name}</strong>
          <span>
            {selected ? `Match ${shortId(selected.id)} · ${formatDay(selected.day)}` : `All matches · ${days.length ? days.map(formatDay).join(', ') : 'Feb 10–14'}`}
          </span>
        </div>
        <dl className="stats">
          {stats.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </header>

      <Sidebar
        maps={manifest.maps}
        mapId={mapId}
        matchCountByMap={matchCountByMap}
        days={manifest.days}
        selectedDays={days}
        matches={matches}
        matchId={selected?.id ?? null}
        onMap={selectMap}
        onDays={setDays}
        onMatch={selectMatch}
      />

      <main className="stage">
        <MapCanvas
          map={map}
          image={image?.id === mapId ? image.img : null}
          journeys={journeys}
          layers={layers}
          time={playback.time}
          complete={playback.complete}
          heat={heatCanvas}
          focus={focus}
          aggregate={!selected}
          onPick={onPick}
        />
        {!data && <div className="map-loading">Loading telemetry…</div>}
        {data && journeys.length === 0 && <div className="map-loading">No journeys match these filters.</div>}
        {!selected && data && journeys.length > 0 && (
          <div className="banner">
            Showing {matches.length} matches aligned by match time. Click any marker or path head to open that match.
          </div>
        )}
        <Timeline
          journeys={journeys}
          layers={layers}
          time={playback.time}
          duration={duration}
          playing={playback.playing}
          speed={playback.speed}
          onTime={playback.seek}
          onPlay={playback.toggle}
          onSpeed={playback.setSpeed}
        />
      </main>

      <LayerPanel
        journeys={journeys}
        layers={layers}
        heat={heat}
        heatRadius={heatRadius}
        aggregate={!selected}
        focus={focus}
        onLayers={setLayers}
        onHeat={setHeat}
        onHeatRadius={setHeatRadius}
        onFocus={setFocus}
      />
    </div>
  )
}

function summarize(journeys: Journey[], first: [string, string | number]): [string, string | number][] {
  let humans = 0
  let bots = 0
  let storm = 0
  let deaths = 0
  for (const { player } of journeys) {
    if (player.bot) bots++
    else humans++
    for (const e of player.events) {
      const g = EVENT_GROUP[e[3]]
      if (g === 'storm') storm++
      if (g === 'death') deaths++
    }
  }
  return [
    first,
    ['Humans', humans],
    ['Bots', bots],
    ['Combat deaths', deaths],
    ['Storm deaths', storm],
  ]
}
