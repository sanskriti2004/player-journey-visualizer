import { describe, expect, it } from 'vitest'
import { densityGrid } from './heatmap'

const peak = (grid: Float32Array, size: number) => {
  let best = 0
  for (let i = 1; i < grid.length; i++) if (grid[i] > grid[best]) best = i
  return [best % size, Math.floor(best / size)]
}

describe('densityGrid', () => {
  it('puts high-v (north) points at the top of the image', () => {
    const [x, y] = peak(densityGrid([[0.25, 0.9]], 1, 64), 64)
    expect(x).toBe(16)
    expect(y).toBe(6)
  })

  it('preserves total mass away from edges', () => {
    const grid = densityGrid([[0.5, 0.5], [0.5, 0.5]], 2, 64)
    expect(grid.reduce((a, b) => a + b, 0)).toBeCloseTo(2, 3)
  })

  it('ignores out-of-range points', () => {
    const grid = densityGrid([[1.5, 0.5], [-0.1, 0.2]], 1, 16)
    expect(grid.every((v) => v === 0)).toBe(true)
  })
})
