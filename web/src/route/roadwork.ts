import type { Position } from 'geojson'
import type { Closure } from '../construction'
import type { LngLat, Route, RouteStop } from './brouter'

/** How close roadwork must come to the route to be on it, in metres: the street ridden, not a road beside the path. */
const NEAR_M = 10

/** A closure's stretch is looked at every this many metres. */
const STEP_M = 10

const M_PER_DEGREE = 111_320

/**
 * The roadwork the route passes: each closure that comes within NEAR_M of it,
 * once, at its point closest to the route. For a closure without a stretch,
 * that is its cone.
 */
export function roadworkOnRoute(route: Route, closures: readonly Closure[]): RouteStop[] {
  if (route.coords.length < 2) return []
  // Metres east and north, close enough at Ottawa's scale.
  const kx = Math.cos((route.coords[0][1] * Math.PI) / 180) * M_PER_DEGREE
  const xs = route.coords.map(([lon]) => lon * kx)
  const ys = route.coords.map(([, lat]) => lat * M_PER_DEGREE)
  const [minX, maxX] = [Math.min(...xs) - NEAR_M, Math.max(...xs) + NEAR_M]
  const [minY, maxY] = [Math.min(...ys) - NEAR_M, Math.max(...ys) + NEAR_M]

  const distance = (x: number, y: number) => {
    let best = Infinity
    for (let i = 1; i < xs.length; i++) {
      const [ax, ay, dx, dy] = [xs[i - 1], ys[i - 1], xs[i] - xs[i - 1], ys[i] - ys[i - 1]]
      const length2 = dx * dx + dy * dy
      const t = length2 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length2)) : 0
      best = Math.min(best, Math.hypot(x - ax - t * dx, y - ay - t * dy))
    }
    return best
  }

  const stops: RouteStop[] = []
  for (const closure of closures) {
    let best = NEAR_M
    let at: LngLat | null = null
    for (const [lon, lat] of closurePoints(closure, kx)) {
      const [x, y] = [lon * kx, lat * M_PER_DEGREE]
      if (x < minX || x > maxX || y < minY || y > maxY) continue
      const d = distance(x, y)
      if (d <= best) [best, at] = [d, [lon, lat]]
    }
    if (at) stops.push({ kind: 'roadwork', lngLat: at, closure: closure.id })
  }
  return stops
}

/** A closure's cone and its stretch, a point at least every STEP_M along it. */
function closurePoints(closure: Closure, kx: number): LngLat[] {
  const lines: Position[][] =
    closure.line?.type === 'LineString'
      ? [closure.line.coordinates]
      : closure.line?.type === 'MultiLineString'
        ? closure.line.coordinates
        : []
  const points: LngLat[] = [closure.at]
  for (const line of lines) {
    for (let i = 1; i < line.length; i++) {
      const [[lon0, lat0], [lon1, lat1]] = [line[i - 1], line[i]]
      const metres = Math.hypot((lon1 - lon0) * kx, (lat1 - lat0) * M_PER_DEGREE)
      const steps = Math.max(1, Math.ceil(metres / STEP_M))
      for (let s = i === 1 ? 0 : 1; s <= steps; s++) {
        points.push([lon0 + ((lon1 - lon0) * s) / steps, lat0 + ((lat1 - lat0) * s) / steps])
      }
    }
  }
  return points
}
