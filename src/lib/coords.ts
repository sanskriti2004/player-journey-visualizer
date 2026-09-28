import type { MapInfo } from '../types'

/** World (x, z) -> normalized minimap UV in [0, 1]. `y` is elevation and is ignored. */
export function worldToUv(map: Pick<MapInfo, 'scale' | 'originX' | 'originZ'>, x: number, z: number): [number, number] {
  return [(x - map.originX) / map.scale, (z - map.originZ) / map.scale]
}

/** UV -> image pixel for an image of `size` px. Image Y grows downward, world Z grows "up" the map. */
export function uvToPixel(u: number, v: number, size: number): [number, number] {
  return [u * size, (1 - v) * size]
}
