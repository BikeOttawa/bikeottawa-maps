import type { FeatureCollection, Point, Polygon } from 'geojson'
import type { LngLat } from './brouter'
import { type Grid, OUTSIDE, type Reach, reachGrids } from './reach'

/** The area covered within so many minutes, one polygon per piece, and a point to label each band at. */
export type ReachArea = FeatureCollection<Polygon | Point, { minutes: number }>
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

/** Directions tried for the row of band labels out from the start. */
const LABEL_DIRECTIONS = 16
/** All else equal, the row goes north-north-east, clear of the panels on the left. */
const PREFERRED_BEARING = 25
/** Metres: band edges closer to the start than this go unlabelled, hidden by its marker. */
const LABEL_CLEAR = 100
/** Metres: a label this close to the one before it is left out (two bands ending together). */
const LABEL_MIN_GAP = 40
/** Metres: labels at least this far apart read well; more room counts for no more. */
const LABEL_ROOM = 250

/** How far along a ray from `from` it last crosses a ring, or -1 if it never does. */
function lastCrossing(ring: number[][], from: number[], direction: number[]): number {
  let far = -1
  for (let i = 0; i < ring.length; i++) {
    const [a, b] = [ring[i], ring[(i + 1) % ring.length]]
    const [ex, ey] = [b[0] - a[0], b[1] - a[1]]
    const denominator = direction[0] * ey - direction[1] * ex
    if (denominator === 0) continue
    const [ax, ay] = [a[0] - from[0], a[1] - from[1]]
    const along = (ax * ey - ay * ex) / denominator
    const onEdge = (ax * direction[1] - ay * direction[0]) / denominator
    if (along > 0 && onEdge >= 0 && onEdge <= 1) far = Math.max(far, along)
  }
  return far
}

/**
 * Where to label each band: along one line out from the start, where it last
 * leaves the band. Of the directions tried, the one that labels the most
 * bands, then with the most room between labels, then nearest the preferred.
 * Distances are in the rings' units, null for a band left unlabelled.
 */
function labelRow(
  bands: number[][][][],
  from: number[],
  metresPerUnit: number,
): { direction: number[]; distances: (number | null)[] } {
  let best = { score: Number.NEGATIVE_INFINITY, direction: [0, 1], distances: [] as (number | null)[] }
  for (let k = 0; k < LABEL_DIRECTIONS; k++) {
    const bearing = (360 * k) / LABEL_DIRECTIONS
    const direction = [Math.sin((bearing * Math.PI) / 180), Math.cos((bearing * Math.PI) / 180)]
    let previous = LABEL_CLEAR - LABEL_MIN_GAP
    let room = Number.POSITIVE_INFINITY
    let count = 0
    const distances = bands.map((rings) => {
      const along = Math.max(-1, ...rings.map((ring) => lastCrossing(ring, from, direction)))
      const metres = along * metresPerUnit
      if (metres < previous + LABEL_MIN_GAP) return null
      if (count > 0) room = Math.min(room, metres - previous)
      previous = metres
      count++
      return along
    })
    const turn = Math.abs(((bearing - PREFERRED_BEARING + 540) % 360) - 180)
    const score = count * 1000 + Math.min(room, LABEL_ROOM) - turn / 2
    if (score > best.score) best = { score, direction, distances }
  }
  return best
}

/**
 * The area the reach covers, as drawn on the map: the same cells as the area
 * figure (see reachCover), outlined and smoothed, in bands of time from the
 * start. Each band is everything reached within its minutes, so they nest.
 * Each band also has a point to label it with, in a row out from the start.
 */
export function reachArea(reach: Reach, minutes: number, start?: LngLat): ReachArea {
  const limits = bandLimits(minutes)
  const grids = reachGrids(reach, limits)
  if (!grids) return { type: 'FeatureCollection', features: [] }
  const { grid, cells } = grids
  const bands = cells.map((band) =>
    outlines(band, grid.width, grid.height).map((ring) => {
      let points = straighten(ring)
      for (let round = 0; round < SMOOTHING; round++) points = smooth(points)
      return points
    }),
  )
  const features: ReachArea['features'] = bands.flatMap((rings, i) =>
    rings.map((ring) => ({
      type: 'Feature' as const,
      properties: { minutes: limits[i] },
      geometry: { type: 'Polygon' as const, coordinates: [toLngLat(ring, grid)] },
    })),
  )
  if (!start) return { type: 'FeatureCollection', features }
  // The start in the outline's doubled grid units (see outlines), where a unit is half a cell.
  const from = [
    2 * ((start[0] * grid.kx - grid.minX) / grid.cell + 0.5),
    2 * ((start[1] * M_PER_DEG - grid.minY) / grid.cell + 0.5),
  ]
  const { direction, distances } = labelRow(bands, from, grid.cell / 2)
  distances.forEach((along, i) => {
    if (along === null) return
    const at = [from[0] + direction[0] * along, from[1] + direction[1] * along]
    features.push({
      type: 'Feature',
      properties: { minutes: limits[i] },
      geometry: { type: 'Point', coordinates: toLngLat([at], grid)[0] },
    })
  })
  return { type: 'FeatureCollection', features }
}
