export const HEAT_GRID = 256

const STOPS: [number, [number, number, number]][] = [
  [0.0, [40, 11, 84]],
  [0.3, [120, 28, 109]],
  [0.55, [188, 55, 84]],
  [0.78, [249, 142, 9]],
  [1.0, [252, 255, 164]],
]

const LUT = (() => {
  const lut = new Uint8ClampedArray(256 * 3)
  for (let i = 0; i < 256; i++) {
    const x = i / 255
    let s = 0
    while (s < STOPS.length - 2 && x > STOPS[s + 1][0]) s++
    const [x0, c0] = STOPS[s]
    const [x1, c1] = STOPS[s + 1]
    const k = (x - x0) / (x1 - x0)
    for (let c = 0; c < 3; c++) lut[i * 3 + c] = c0[c] + (c1[c] - c0[c]) * k
  }
  return lut
})()

export const HEAT_GRADIENT_CSS = `linear-gradient(90deg, ${STOPS.map(([x, c]) => `rgb(${c.join(',')}) ${x * 100}%`).join(', ')})`

function boxBlur(src: Float32Array, size: number, r: number): Float32Array<ArrayBuffer> {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const w = 2 * r + 1
  for (let y = 0; y < size; y++) {
    let acc = 0
    for (let x = -r; x <= r; x++) acc += src[y * size + Math.min(size - 1, Math.max(0, x))]
    for (let x = 0; x < size; x++) {
      tmp[y * size + x] = acc / w
      acc += src[y * size + Math.min(size - 1, x + r + 1)] - src[y * size + Math.max(0, x - r)]
    }
  }
  for (let x = 0; x < size; x++) {
    let acc = 0
    for (let y = -r; y <= r; y++) acc += tmp[Math.min(size - 1, Math.max(0, y)) * size + x]
    for (let y = 0; y < size; y++) {
      out[y * size + x] = acc / w
      acc += tmp[Math.min(size - 1, y + r + 1) * size + x] - tmp[Math.max(0, y - r) * size + x]
    }
  }
  return out
}

/** Accumulate UV points into a grid (row 0 = top of the image) and smooth with a ~gaussian blur. */
export function densityGrid(points: Iterable<[number, number]>, radius: number, size = HEAT_GRID): Float32Array {
  let grid = new Float32Array(size * size)
  for (const [u, v] of points) {
    const gx = Math.floor(u * size)
    const gy = Math.floor((1 - v) * size)
    if (gx < 0 || gy < 0 || gx >= size || gy >= size) continue
    grid[gy * size + gx] += 1
  }
  for (let pass = 0; pass < 3; pass++) grid = boxBlur(grid, size, radius)
  return grid
}

/** Colorize a density grid; values are normalized against the 99.5th percentile so one hotspot can't wash out the rest. */
export function renderHeatmap(grid: Float32Array, size = HEAT_GRID): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const nonZero = Array.from(grid).filter((v) => v > 0).sort((a, b) => a - b)
  const ref = nonZero.length ? nonZero[Math.floor(nonZero.length * 0.995)] || nonZero[nonZero.length - 1] : 1
  const img = new ImageData(size, size)
  for (let i = 0; i < grid.length; i++) {
    const n = Math.min(1, Math.sqrt(grid[i] / ref))
    if (n < 0.12) continue
    const li = Math.round(n * 255) * 3
    img.data[i * 4] = LUT[li]
    img.data[i * 4 + 1] = LUT[li + 1]
    img.data[i * 4 + 2] = LUT[li + 2]
    img.data[i * 4 + 3] = Math.round(Math.min(1, 0.15 + n) * 220)
  }
  canvas.getContext('2d')!.putImageData(img, 0, 0)
  return canvas
}
