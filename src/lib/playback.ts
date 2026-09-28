/** Interpolated [u, v] of a flat [t, u, v, ...] path at time t, or null outside the recorded span. */
export function positionAt(path: number[], t: number): [number, number] | null {
  const n = path.length / 3
  if (n === 0 || t < path[0] || t > path[(n - 1) * 3]) return null
  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (path[mid * 3] <= t) lo = mid
    else hi = mid
  }
  const t0 = path[lo * 3]
  const t1 = path[hi * 3]
  const k = t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 0
  return [
    path[lo * 3 + 1] + (path[hi * 3 + 1] - path[lo * 3 + 1]) * k,
    path[lo * 3 + 2] + (path[hi * 3 + 2] - path[lo * 3 + 2]) * k,
  ]
}

/** Number of samples with timestamp <= t. */
export function samplesUntil(path: number[], t: number): number {
  let lo = 0
  let hi = path.length / 3
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (path[mid * 3] <= t) lo = mid + 1
    else hi = mid
  }
  return lo
}
