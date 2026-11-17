import { describe, expect, it } from 'vitest'
import { pieMinSize, spotSize } from './pieImage'

describe('spots', () => {
  it('are sized against the busiest, so it is as big on every layer, and a handful never makes a big spot', () => {
    expect(spotSize(1, 127)).toBe(0)
    expect(spotSize(127, 127)).toBe(1)
    expect(spotSize(10, 10)).toBe(1)
    expect(spotSize(3, 3)).toBeCloseTo(Math.sqrt(2 / 9))
  })
  it('show their split as a pie once big enough for the slices to read, smaller ones as the map zooms in', () => {
    expect(pieMinSize(12)).toBeCloseTo(2 / 7)
    expect(pieMinSize(17)).toBe(0)
    expect(pieMinSize(14)).toBeLessThan(pieMinSize(13))
  })
})
