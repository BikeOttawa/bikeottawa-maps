import { describe, expect, it } from 'vitest'
import { type Reach, reachCover } from './reach'
import { bandLimits, reachArea } from './reachArea'

/** Square metres inside a lon/lat ring near the equator. */
function m2(ring: number[][]): number {
  let sum = 0
  for (let i = 1; i < ring.length; i++) sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1]
  return (Math.abs(sum) / 2) * 111_320 ** 2
}

// A loop round a block of about 1.1 km, reached in the first two minutes, and
// a street leading off it reached in the next three.
const reach: Reach = {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { minutes: 2 },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [0, 0],
            [0.01, 0],
            [0.01, 0.01],
            [0, 0.01],
            [0, 0],
          ],
        ],
      },
    },
    {
      type: 'Feature',
      properties: { minutes: 5 },
      geometry: {
        type: 'MultiLineString',
        coordinates: [
          [
            [0.01, 0.005],
            [0.02, 0.005],
          ],
        ],
      },
    },
  ],
}

describe('bandLimits', () => {
  it('splits the time into five bands', () => {
    expect(bandLimits(5)).toEqual([1, 2, 3, 4, 5])
    expect(bandLimits(30)).toEqual([6, 12, 18, 24, 30])
  })
})

describe('reachArea', () => {
  const area = reachArea(reach, 5)

  it('outlines the area the area figure counts, in bands that grow with time', () => {
    const outer = area.features.filter((f) => f.properties.minutes === 5)
    expect(outer).toHaveLength(1)
    const ring = outer[0].geometry.coordinates[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(m2(ring)).toBeCloseTo(reachCover(reach).area, -4)
    // Nothing yet in the first minute; the block from the second; the street from the fifth.
    const sizeAt = (minutes: number) =>
      area.features
        .filter((f) => f.properties.minutes === minutes)
        .reduce((s, f) => s + m2(f.geometry.coordinates[0]), 0)
    expect(sizeAt(1)).toBe(0)
    expect(sizeAt(2)).toBeGreaterThan(1e6)
    expect(sizeAt(5)).toBeGreaterThan(sizeAt(2))
  })

  it('rounds off the grid’s corners', () => {
    const ring = area.features[0].geometry.coordinates[0]
    const turns = ring.slice(1, -1).map((p, i) => {
      const [a, b] = [ring[i], ring[i + 2]]
      const [ux, uy, vx, vy] = [p[0] - a[0], p[1] - a[1], b[0] - p[0], b[1] - p[1]]
      return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))
    })
    // No square turns left: each step turns by well under a right angle.
    expect(Math.max(...turns)).toBeLessThan(Math.PI / 3)
  })
})
