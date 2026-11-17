import { describe, expect, it } from 'vitest'
import { offered, sharedShare, worthOffering } from './alternatives'
import type { Route } from './brouter'

// A metre north, in degrees; routes run about 780 m east along 45.4°N.
const NORTH = 1 / 111_320

const route = (time: number, ...coords: [number, number][]): Route => ({
  coords,
  distance: 0,
  time,
  ascent: 0,
  segments: [],
  stops: [],
})

/** A straight route east, `north` metres off 45.4°N, with a point every 10 m or so. */
const east = (time: number, north = 0) =>
  route(time, ...Array.from({ length: 79 }, (_, i): [number, number] => [-75.7 + i * 0.000128, 45.4 + north * NORTH]))

describe('route alternatives', () => {
  it('measures how much of one route runs along another', () => {
    expect(sharedShare(east(600), east(600))).toBe(1)
    expect(sharedShare(east(600), east(600, 10))).toBe(1)
    expect(sharedShare(east(600), east(600, 400))).toBe(0)
  })

  it('offers an alternative on other streets, not much slower', () => {
    const best = east(600)
    expect(worthOffering(east(700, 400), [best])).toBe(true)
    expect(worthOffering(east(900, 400), [best])).toBe(false)
    expect(worthOffering(east(620, 5), [best])).toBe(false)
  })

  it('keeps the best, then those worth offering in order, three at most', () => {
    const best = east(600)
    const [a, b, c] = [east(650, 300), east(640, 300), east(660, -300)]
    expect(offered(best, [a, b, null, c])).toEqual([best, a, c])
    expect(offered(best, [east(610, 200), east(610, 400), east(610, 600)])).toHaveLength(3)
  })
})
