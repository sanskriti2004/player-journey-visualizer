import { describe, expect, it } from 'vitest'
import { uvToPixel, worldToUv } from './coords'

const ambrose = { scale: 900, originX: -370, originZ: -473 }

describe('worldToUv / uvToPixel', () => {
  it('matches the worked example in the dataset README', () => {
    const [u, v] = worldToUv(ambrose, -301.45, -355.55)
    const [px, py] = uvToPixel(u, v, 1024)
    expect(Math.round(px)).toBe(78)
    expect(Math.round(py)).toBe(890)
  })

  it('maps the origin to the bottom-left corner and origin+scale to the top-right', () => {
    expect(uvToPixel(...worldToUv(ambrose, -370, -473), 2048)).toEqual([0, 2048])
    expect(uvToPixel(...worldToUv(ambrose, 530, 427), 2048)).toEqual([2048, 0])
  })
})
