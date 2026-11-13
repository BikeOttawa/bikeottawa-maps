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
  // Starting from the middle of the block.
  const area = reachArea(reach, 5, [0.005, 0.005])
  const rings = (minutes?: number) =>
    area.features.flatMap((f) =>
      f.geometry.type === 'Polygon' && (minutes === undefined || f.properties.minutes === minutes)
        ? [f.geometry.coordinates[0]]
        : [],
    )

  it('outlines the area the area figure counts, in bands that grow with time', () => {
    const outer = rings(5)
    expect(outer).toHaveLength(1)
    const ring = outer[0]
    expect(ring[0]).toEqual(ring[ring.length - 1])
    expect(m2(ring)).toBeCloseTo(reachCover(reach).area, -4)
    // Nothing yet in the first minute; the block from the second; the street from the fifth.
    const sizeAt = (minutes: number) => rings(minutes).reduce((s, ring) => s + m2(ring), 0)
    expect(sizeAt(1)).toBe(0)
    expect(sizeAt(2)).toBeGreaterThan(1e6)
    expect(sizeAt(5)).toBeGreaterThan(sizeAt(2))
  })

  it('labels each band where a line from the start leaves it', () => {
    const labels = area.features.flatMap((f) =>
      f.geometry.type === 'Point' ? [{ minutes: f.properties.minutes, at: f.geometry.coordinates }] : [],
    )
    // Bands 2 to 5 all end at the block's north side here; the first has nothing to label.
    expect(labels.map((l) => l.minutes)).toEqual([2, 3, 4, 5])
    for (const { at } of labels) {
      expect(at[1]).toBeCloseTo(0.01, 3)
      // North-north-east of the start.
      expect(at[0]).toBeGreaterThan(0.005)
    }
    expect(reachArea(reach, 5).features.every((f) => f.geometry.type === 'Polygon')).toBe(true)
  })

  it('rounds off the grid’s corners', () => {
    const ring = rings()[0]
    const turns = ring.slice(1, -1).map((p, i) => {
      const [a, b] = [ring[i], ring[i + 2]]
      const [ux, uy, vx, vy] = [p[0] - a[0], p[1] - a[1], b[0] - p[0], b[1] - p[1]]
      return Math.abs(Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy))
    })
    // No square turns left: each step turns by well under a right angle.
    expect(Math.max(...turns)).toBeLessThan(Math.PI / 3)
  })
})
