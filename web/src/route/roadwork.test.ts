import { describe, expect, it } from 'vitest'
import type { Closure } from '../construction'
import type { Route } from './brouter'
import { roadworkOnRoute } from './roadwork'

// About 780 m east along 45.4°N; a metre north is this many degrees.
const route: Route = {
  coords: [
    [-75.7, 45.4],
    [-75.69, 45.4],
  ],
  distance: 780,
  time: 180,
  ascent: 0,
  segments: [],
  stops: [],
}
const NORTH = 1 / 111_320

const closure = (at: [number, number], line?: Closure['line']): Closure => ({
  id: `ottawa-${at.join()}`,
  at,
  line,
  headline: '',
  message: '',
})

describe('roadworkOnRoute', () => {
  it('counts roadwork on the street ridden, at its cone', () => {
    const near = closure([-75.695, 45.4 + 5 * NORTH])
    expect(roadworkOnRoute(route, [near])).toEqual([{ kind: 'roadwork', lngLat: near.at, closure: near.id }])
  })

  it('leaves out roadwork on a road beside the path, a street over, or past the end', () => {
    const away = [15, 50].map((m) => closure([-75.695, 45.4 + m * NORTH]))
    expect(roadworkOnRoute(route, [...away, closure([-75.688, 45.4])])).toEqual([])
  })

  it('finds a stretch the route crosses far from its cone, where it crosses', () => {
    const crossing = closure([-75.695, 45.4 + 200 * NORTH], {
      type: 'LineString',
      coordinates: [
        [-75.695, 45.4 - 100 * NORTH],
        [-75.695, 45.4 + 500 * NORTH],
      ],
    })
    const [stop, ...rest] = roadworkOnRoute(route, [crossing])
    expect(rest).toEqual([])
    expect(stop.lngLat[0]).toBeCloseTo(-75.695)
    expect(Math.abs(stop.lngLat[1] - 45.4) / NORTH).toBeLessThan(10)
  })
})
