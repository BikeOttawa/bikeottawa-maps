import { describe, expect, it } from 'vitest'
import { pieMinCount } from './pieImage'

describe('pies', () => {
  it('go on spots big enough for their slices to read, smaller ones as the map zooms in', () => {
    expect(pieMinCount(12)).toBe(10)
    expect(pieMinCount(13)).toBe(7)
    expect(pieMinCount(14)).toBe(4)
    expect(pieMinCount(15)).toBe(3)
    expect(pieMinCount(16)).toBe(2)
    expect(pieMinCount(20)).toBe(2)
  })
})
