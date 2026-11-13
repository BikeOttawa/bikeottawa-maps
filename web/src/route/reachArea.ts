import type { FeatureCollection, Polygon } from 'geojson'
import { type Grid, OUTSIDE, type Reach, reachGrids } from './reach'

/** The area covered within so many minutes, one feature per piece. */
export type ReachArea = FeatureCollection<Polygon, { minutes: number }>
/** What the map draws for How far: the streets reached, or the area. */
export type ReachShape = Reach | ReachArea

const M_PER_DEG = 111_320
/** Bands of the area: the time split this many ways, closest first. */
const BANDS = 5
/** Rounds of corner cutting that smooth the grid's steps into curves. */
const SMOOTHING = 3

/**
 * The outlines of the cells inside the area (not OUTSIDE), in doubled grid
 * units: a cell's centre is at twice its column and row, and each outline runs
 * halfway between a cell inside and one outside (marching squares). Cells that
 * touch only at a corner count as joined, as the area's flood fill has it, so
 * no outline has a hole in it.
 */
function outlines(cells: Uint8Array, width: number, height: number): number[][][] {
  const inside = (x: number, y: number) => cells[y * width + x] !== OUTSIDE
  const stride = 2 * width
  const key = (x: number, y: number) => y * stride + x
  // Each point on an outline joins two others.
  const links = new Map<number, number[]>()
  const link = (a: number, b: number) => {
    const at = links.get(a)
    if (at) at.push(b)
    else links.set(a, [b])
    const bt = links.get(b)
    if (bt) bt.push(a)
    else links.set(b, [a])
  }
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      // Corners: bottom left, bottom right, top right, top left.
      const a = inside(x, y)
      const b = inside(x + 1, y)
      const c = inside(x + 1, y + 1)
      const d = inside(x, y + 1)
      if (a === b && b === c && c === d) continue
      const south = key(2 * x + 1, 2 * y)
      const east = key(2 * x + 2, 2 * y + 1)
      const north = key(2 * x + 1, 2 * y + 2)
      const west = key(2 * x, 2 * y + 1)
      if (a && c && !b && !d) {
        link(south, east)
        link(north, west)
      } else if (b && d && !a && !c) {
        link(west, south)
        link(east, north)
      } else {
        const crossed = [a !== b && south, b !== c && east, c !== d && north, d !== a && west].filter(
          (point): point is number => point !== false,
        )
        link(crossed[0], crossed[1])
      }
    }
  }
  const rings: number[][][] = []
  for (const start of links.keys()) {
    if (!links.get(start)?.length) continue
    const ring: number[][] = []
    let [previous, current] = [-1, start]
    for (;;) {
      ring.push([current % stride, Math.floor(current / stride)])
      const next = links.get(current) as number[]
      links.set(current, [])
      const step = next[0] === previous && next.length > 1 ? next[1] : next[0]
      if (step === start || step === undefined) break
      ;[previous, current] = [current, step]
    }
    rings.push(ring)
  }
  return rings
}

/** Chaikin's corner cutting on a closed ring. */
function smooth(ring: number[][]): number[][] {
  const out: number[][] = []
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    out.push(
      [0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]],
      [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]],
    )
  }
  return out
}

/** Drops points that lie on a straight line between their neighbours. */
function straighten(ring: number[][]): number[][] {
  return ring.filter((p, i) => {
    const a = ring[(i + ring.length - 1) % ring.length]
    const b = ring[(i + 1) % ring.length]
    return (p[0] - a[0]) * (b[1] - a[1]) !== (p[1] - a[1]) * (b[0] - a[0])
  })
}

function toLngLat(ring: number[][], { kx, minX, minY, cell }: Grid): number[][] {
  const out = ring.map(([x, y]) => [
    Math.round(((minX + (x / 2 - 0.5) * cell) / kx) * 1e6) / 1e6,
    Math.round(((minY + (y / 2 - 0.5) * cell) / M_PER_DEG) * 1e6) / 1e6,
  ])
  out.push(out[0])
  return out
}

/** The minutes each band reaches: the time split into BANDS. */
export function bandLimits(minutes: number): number[] {
  return Array.from({ length: BANDS }, (_, i) => Math.round((minutes * (i + 1)) / BANDS))
}

/**
 * The area the reach covers, as drawn on the map: the same cells as the area
 * figure (see reachCover), outlined and smoothed, in bands of time from the
 * start. Each band is everything reached within its minutes, so they nest.
 */
export function reachArea(reach: Reach, minutes: number): ReachArea {
  const limits = bandLimits(minutes)
  const grids = reachGrids(reach, limits)
  if (!grids) return { type: 'FeatureCollection', features: [] }
  const { grid, cells } = grids
  return {
    type: 'FeatureCollection',
    features: cells.flatMap((band, i) =>
      outlines(band, grid.width, grid.height).map((ring) => {
        let points = straighten(ring)
        for (let round = 0; round < SMOOTHING; round++) points = smooth(points)
        return {
          type: 'Feature' as const,
          properties: { minutes: limits[i] },
          geometry: { type: 'Polygon' as const, coordinates: [toLngLat(points, grid)] },
        }
      }),
    ),
  }
}
