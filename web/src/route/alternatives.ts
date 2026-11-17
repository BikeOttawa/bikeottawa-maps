import type { Route } from './brouter'

/** How many routes a trip offers at most: the router's best and its next ones. */
export const MAX_ROUTES = 3

/** An alternative much slower than the best is not worth offering. */
const SLOWER_AT_MOST = 1.4

/** Nor one that mostly rides the same streets as one already offered. */
const SHARED_AT_MOST = 0.6

/** How close a stretch must run to another route to count as the same, in metres. */
const SAME_M = 25

const M_PER_DEGREE = 111_320

/**
 * How much of route `a` runs along route `b`, by length, from 0 to 1. Each
 * stretch counts when its middle is within SAME_M of a point of `b`, looked
 * up in a grid of SAME_M cells.
 */
export function sharedShare(a: Route, b: Route): number {
  if (a.coords.length < 2 || !b.coords.length) return 0
  const kx = Math.cos((a.coords[0][1] * Math.PI) / 180) * M_PER_DEGREE
  const cell = (lon: number, lat: number) => [
    Math.floor((lon * kx) / SAME_M),
    Math.floor((lat * M_PER_DEGREE) / SAME_M),
  ]
  const near = new Set<string>()
  for (const [lon, lat] of b.coords) {
    const [x, y] = cell(lon, lat)
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) near.add(`${x + dx},${y + dy}`)
  }
  let total = 0
  let shared = 0
  for (let i = 1; i < a.coords.length; i++) {
    const [[lon0, lat0], [lon1, lat1]] = [a.coords[i - 1], a.coords[i]]
    const length = Math.hypot((lon1 - lon0) * kx, (lat1 - lat0) * M_PER_DEGREE)
    total += length
    const [x, y] = cell((lon0 + lon1) / 2, (lat0 + lat1) / 2)
    if (near.has(`${x},${y}`)) shared += length
  }
  return total ? shared / total : 0
}

/** Whether an alternative is worth offering next to those kept: not much slower than the best, nor mostly the same. */
export function worthOffering(candidate: Route, kept: readonly Route[]): boolean {
  const [best] = kept
  if (!best) return true
  if (candidate.time > best.time * SLOWER_AT_MOST) return false
  return kept.every((route) => sharedShare(candidate, route) <= SHARED_AT_MOST)
}

/** The alternatives worth offering, in the router's order, after the best. */
export function offered(best: Route, alternatives: readonly (Route | null | undefined)[]): Route[] {
  const kept = [best]
  for (const route of alternatives) {
    if (route && kept.length < MAX_ROUTES && worthOffering(route, kept)) kept.push(route)
  }
  return kept
}
