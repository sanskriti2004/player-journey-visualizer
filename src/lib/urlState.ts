import type { HeatmapMode } from '../types'

export interface UrlState {
  map?: string
  days: string[]
  match: string | null
  heat: HeatmapMode
}

const HEATS: HeatmapMode[] = ['off', 'traffic', 'kill', 'death', 'storm', 'loot']

export function readUrlState(): UrlState {
  const p = new URLSearchParams(window.location.hash.slice(1))
  const heat = p.get('heat') as HeatmapMode
  return {
    map: p.get('map') ?? undefined,
    days: p.get('days')?.split(',').filter(Boolean) ?? [],
    match: p.get('match'),
    heat: HEATS.includes(heat) ? heat : 'off',
  }
}

export function writeUrlState(s: UrlState) {
  const p = new URLSearchParams()
  if (s.map) p.set('map', s.map)
  if (s.days.length) p.set('days', s.days.join(','))
  if (s.match) p.set('match', s.match)
  if (s.heat !== 'off') p.set('heat', s.heat)
  const hash = `#${p.toString().replace(/%2C/g, ',')}`
  if (hash !== window.location.hash) history.replaceState(null, '', hash)
}
