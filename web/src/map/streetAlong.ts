import type { Geometry, Position } from 'geojson'

/** A named street near a click, as the basemap draws it. */
export interface Street {
  name: string
  geometry: Geometry
}

/** Within this many metres of the click, a street can be the one a project runs along. */
const NEAR_M = 30
/** And within this many degrees of the project's direction there. */
const ALIGNED_DEG = 30

type Segment = [Position, Position]

function segmentsOf(geometry: Geometry): Segment[] {
  const lines =
    geometry.type === 'LineString'
      ? [geometry.coordinates]
      : geometry.type === 'MultiLineString'
        ? geometry.coordinates
        : geometry.type === 'Polygon'
          ? geometry.coordinates
          : []
  return lines.flatMap((line) => line.slice(1).map((p, i): Segment => [line[i], p]))
}

/** Metres from a point to a segment, and the segment's direction in degrees (0 to 180), near Ottawa's latitude. */
function measure(at: Position, [a, b]: Segment): { metres: number; bearing: number } {
  const kx = 111320 * Math.cos((at[1] * Math.PI) / 180)
  const ky = 110574
  const [ax, ay, bx, by, px, py] = [a[0] * kx, a[1] * ky, b[0] * kx, b[1] * ky, at[0] * kx, at[1] * ky]
  const [dx, dy] = [bx - ax, by - ay]
  const t = dx || dy ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy))) : 0
  const metres = Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
  const bearing = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180
  return { metres, bearing }
}

function nearest(at: Position, geometry: Geometry): { metres: number; bearing: number } | null {
  let best: { metres: number; bearing: number } | null = null
  for (const segment of segmentsOf(geometry)) {
    const m = measure(at, segment)
    if (!best || m.metres < best.metres) best = m
  }
  return best
}

/**
 * The street a project runs along at a click: for a line, the nearest street
 * going the same way there, so a crossing street is not taken for it, and
 * none when it crosses open ground; for a point, the nearest street.
 */
export function streetAlong(at: Position, project: Geometry, streets: readonly Street[]): string | null {
  const own = project.type === 'Point' ? null : nearest(at, project)
  let best: { name: string; metres: number } | null = null
  for (const street of streets) {
    const near = nearest(at, street.geometry)
    if (!near || near.metres > NEAR_M) continue
    if (own) {
      const turn = Math.abs(near.bearing - own.bearing)
      if (Math.min(turn, 180 - turn) > ALIGNED_DEG) continue
    }
    if (!best || near.metres < best.metres) best = { name: street.name, metres: near.metres }
  }
  return best?.name ?? null
}
