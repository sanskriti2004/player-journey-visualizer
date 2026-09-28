import type { Manifest, MapData } from '../types'

const base = import.meta.env.BASE_URL

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}${path}`)
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`)
  return res.json() as Promise<T>
}

export const loadManifest = () => getJson<Manifest>('data/manifest.json')

const mapCache = new Map<string, Promise<MapData>>()

export function loadMapData(mapId: string): Promise<MapData> {
  let p = mapCache.get(mapId)
  if (!p) {
    p = getJson<MapData>(`data/${mapId}.json`)
    p.catch(() => mapCache.delete(mapId))
    mapCache.set(mapId, p)
  }
  return p
}

export const imageUrl = (path: string) => `${base}${path}`
