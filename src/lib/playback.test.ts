import { describe, expect, it } from 'vitest'
import { positionAt, samplesUntil } from './playback'

const path = [0, 0, 0, 10, 1, 0.5, 20, 1, 1]

describe('positionAt', () => {
  it('interpolates between samples', () => {
    expect(positionAt(path, 5)).toEqual([0.5, 0.25])
    expect(positionAt(path, 15)).toEqual([1, 0.75])
  })

  it('returns exact samples at their timestamps', () => {
    expect(positionAt(path, 10)).toEqual([1, 0.5])
  })

  it('returns null outside the recorded span', () => {
    expect(positionAt(path, -1)).toBeNull()
    expect(positionAt(path, 21)).toBeNull()
    expect(positionAt([], 0)).toBeNull()
  })

  it('handles duplicate timestamps', () => {
    expect(positionAt([5, 0.1, 0.1, 5, 0.2, 0.2], 5)).not.toBeNull()
  })
})

describe('samplesUntil', () => {
  it('counts samples at or before t', () => {
    expect(samplesUntil(path, -1)).toBe(0)
    expect(samplesUntil(path, 0)).toBe(1)
    expect(samplesUntil(path, 10)).toBe(2)
    expect(samplesUntil(path, 99)).toBe(3)
  })
})
