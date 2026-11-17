import stressmodel from 'stressmodel/stressmodel.js'
import type { Profile } from './styles'

export type LngLat = [lon: number, lat: number]

/** A stretch of the route along one kind of way. */
/** Why a stretch is walked: a sidewalk closed to bikes, stairs, or anything else (dismount signs, no-bike paths). */
export type WalkKind = 'sidewalk' | 'stairs' | 'other'

export interface RouteSegment {
  coords: [number, number][]
  /** Metres. */
  distance: number
  /** Level of traffic stress 1-4, or 0 where the bike is walked. */
  lts: number
  /** What kind of walking a level-0 stretch is. */
  walk: WalkKind | null
  tags: Record<string, string>
  /** Ridden against the way's direction, so its left side is on the right. */
  reversed: boolean
}

/**
 * What the route stops or slows down for: stop signs, traffic lights, barriers
 * across the way, and roadwork on the roadwork overlay (route/roadwork.ts).
 */
export const STOP_KINDS = ['stop', 'light', 'barrier', 'roadwork'] as const
export type StopKind = (typeof STOP_KINDS)[number]

export interface RouteStop {
  kind: StopKind
  lngLat: LngLat
  /** For a barrier, its OSM `barrier` value: bollard, gate, cycle_barrier… (`kerb` for a raised kerb). */
  barrier?: string
  /** For roadwork, the closure's id on the Roadwork overlay. */
  closure?: string
  /** What it is, in a few words, for its bubble on the map. */
  label?: string
}

export interface Route {
  /** [lon, lat, elevation in metres], elevation missing where unknown. */
  coords: [number, number, number?][]
  /** Metres. */
  distance: number
  /** Seconds. */
  time: number
  /** Metres climbed. */
  ascent: number
  segments: RouteSegment[]
  stops: RouteStop[]
}

export class RouteError extends Error {}

/** The profile's parameters, as BRouter takes them in a request. */
export function profileQuery({ name, params }: Profile): string {
  const tuning = Object.entries(params).map(([key, value]) => `&profile:${key}=${value}`)
  return `profile=${name}${tuning.join('')}`
}

/** The router's route between points: its best (0), or its next best (1 to 3), each away from those before. */
export function routeUrl(base: string, points: readonly LngLat[], profile: Profile, alternative = 0): string {
  const lonlats = points.map(([lon, lat]) => `${lon.toFixed(6)},${lat.toFixed(6)}`).join('|')
  return `${base}?lonlats=${lonlats}&alternativeidx=${alternative}&format=geojson&${profileQuery(profile)}`
}

function parseTags(text: string): Record<string, string> {
  const tags: Record<string, string> = {}
  for (const pair of text.split(' ')) {
    const i = pair.indexOf('=')
    // reversedirection is BRouter's own marker, not an OSM tag.
    if (i > 0 && !pair.startsWith('reversedirection=')) tags[pair.slice(0, i)] = pair.slice(i + 1)
  }
  return tags
}

/**
 * Stress level of a stretch of route (0 = the bike is walked) and, for walked
 * stretches, why. The stress model rates stairs and dismount sections as
 * paths, so those are caught here.
 */
export function rateStretch(tags: Record<string, string>): { lts: number; walk: WalkKind | null } {
  if (tags.highway === 'steps') return { lts: 0, walk: 'stairs' }
  if (tags.bicycle === 'dismount') return { lts: 0, walk: 'other' }
  const lts = stressmodel.evaluateLTS({ tags }).lts
  if (lts > 0) return { lts, walk: null }
  return { lts, walk: tags.footway === 'sidewalk' ? 'sidewalk' : 'other' }
}

/** Closer together than this, in metres, signs or signals belong to the same junction. */
const SAME_STOP_M = 30
const SAME_LIGHTS_M = 60
/** Barrier nodes this close are parts of one barrier, such as the two arms of a chicane. */
const SAME_BARRIER_M = 10

/** Barriers a bike gets through as on open road: a way in, a booth, a border, a cattle grid, a height limit. */
const NO_OBSTACLE = new Set([
  'entrance',
  'toll_booth',
  'border_control',
  'cattle_grid',
  'height_restrictor',
  'no',
  'kerb',
])

/** The barrier at a node, if any. A kerb counts only when raised, for a trailer or a cargo bike must lift over it. */
function barrierAt(node: string): string | null {
  if (node.includes(' kerb=raised ')) return 'kerb'
  const value = / barrier=(\S+) /.exec(node)?.[1]
  return value && !NO_OBSTACLE.has(value) ? value : null
}

/**
 * Stop signs, traffic lights and barriers along the route, from the tags in
 * BRouter's messages. A stop sign counts only when it faces the direction of
 * travel, and the several signal heads of one junction count once.
 */
export function findStops(header: string[], rows: string[][]): RouteStop[] {
  const col = (name: string) => header.indexOf(name)
  const [iLon, iLat, iDist, iWay, iNode] = [
    col('Longitude'),
    col('Latitude'),
    col('Distance'),
    col('WayTags'),
    col('NodeTags'),
  ]
  if (iNode < 0) return []
  const stops: RouteStop[] = []
  let sinceStop = Number.POSITIVE_INFINITY
  let sinceLights = Number.POSITIVE_INFINITY
  let sinceBarrier = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const distance = Number(row[iDist]) || 0
    sinceStop += distance
    sinceLights += distance
    sinceBarrier += distance
    const node = ` ${row[iNode] ?? ''} `
    const lngLat: LngLat = [Number(row[iLon]) / 1e6, Number(row[iLat]) / 1e6]

    if (node.includes(' highway=stop ')) {
      const reversed = (row[iWay] ?? '').includes('reversedirection=yes')
      const facesUs =
        !node.includes(' direction=') || node.includes(reversed ? ' direction=backward ' : ' direction=forward ')
      if (facesUs && sinceStop > SAME_STOP_M) {
        stops.push({ kind: 'stop', lngLat })
        sinceStop = 0
      }
    }
    // Signals are tagged on the junction node, on the crossing node, or only on
    // the crossing way the route rides along.
    const way = ` ${row[iWay] ?? ''} `
    const signalled =
      node.includes(' highway=traffic_signals ') ||
      node.includes(' crossing=traffic_signals ') ||
      node.includes(' crossing:signals=yes ') ||
      way.includes(' crossing=traffic_signals ') ||
      way.includes(' crossing=pedestrian_signals ') ||
      way.includes(' crossing:signals=yes ')
    if (signalled && sinceLights > SAME_LIGHTS_M) {
      stops.push({ kind: 'light', lngLat })
      sinceLights = 0
    }
    const barrier = barrierAt(node)
    if (barrier) {
      if (sinceBarrier > SAME_BARRIER_M) stops.push({ kind: 'barrier', lngLat, barrier })
      sinceBarrier = 0
    }
  }
  return stops
}

/** Turns BRouter's GeoJSON answer into a route split into segments by way. */
export function parseRoute(geojson: unknown): Route {
  const feature = (
    geojson as { features?: { properties: Record<string, unknown>; geometry: { coordinates: number[][] } }[] }
  ).features?.[0]
  if (!feature) throw new RouteError('No route in response')
  const props = feature.properties
  const coords = feature.geometry.coordinates as [number, number, number?][]

  // The first row names the columns; each later row describes the stretch
  // ending at its Longitude/Latitude (in millionths of a degree).
  const [header, ...rows] = (props.messages ?? [[]]) as string[][]
  const col = (name: string) => header.indexOf(name)
  const [iLon, iLat, iDist, iTags] = [col('Longitude'), col('Latitude'), col('Distance'), col('WayTags')]

  const segments: RouteSegment[] = []
  let start = 0
  for (const row of rows) {
    const lon = Number(row[iLon])
    const lat = Number(row[iLat])
    let end = start
    while (
      end < coords.length &&
      (Math.round(coords[end][0] * 1e6) !== lon || Math.round(coords[end][1] * 1e6) !== lat)
    )
      end++
    // A row that matches no point is skipped rather than guessed at.
    if (end >= coords.length || end === start) continue
    const tags = parseTags(row[iTags] ?? '')
    segments.push({
      coords: coords.slice(start, end + 1).map(([x, y]) => [x, y]),
      distance: Number(row[iDist]),
      ...rateStretch(tags),
      tags,
      reversed: (row[iTags] ?? '').includes('reversedirection=yes'),
    })
    start = end
  }

  return {
    coords,
    distance: Number(props['track-length']),
    time: Number(props['total-time']),
    ascent: Math.max(0, Number(props['filtered ascend'])),
    segments,
    stops: findStops(header, rows),
  }
}

export async function fetchRoute(
  base: string,
  points: readonly LngLat[],
  profile: Profile,
  signal?: AbortSignal,
  alternative = 0,
): Promise<Route> {
  const res = await fetch(routeUrl(base, points, profile, alternative), { signal })
  // BRouter answers failures (no road nearby, outside the covered area) as plain text.
  if (!res.ok) throw new RouteError((await res.text()).trim() || `Routing failed (${res.status})`)
  const text = await res.text()
  try {
    return parseRoute(JSON.parse(text))
  } catch (cause) {
    throw cause instanceof RouteError ? cause : new RouteError(text.slice(0, 200))
  }
}

/** The parts of the comfort breakdown, most comfortable first. */
export const COMFORT_KEYS = ['lts1', 'lts2', 'lts3', 'lts4', 'sidewalk', 'stairs', 'other'] as const
export type ComfortKey = (typeof COMFORT_KEYS)[number]

/**
 * Something in the route legend that can be picked out on the map: a part of
 * the breakdown on show (route/breakdown.ts), or a kind of stop (STOP_KINDS).
 */
export type RouteHighlight = string

/** Which part of the comfort breakdown a segment belongs to. */
export function comfortKeyOf(segment: Pick<RouteSegment, 'lts' | 'walk'>): ComfortKey {
  return segment.walk ?? (`lts${segment.lts}` as ComfortKey)
}

/** Metres of the route in each part of the comfort breakdown. */
export function distanceByComfort(route: Route): Record<ComfortKey, number> {
  const totals: Record<ComfortKey, number> = { lts1: 0, lts2: 0, lts3: 0, lts4: 0, sidewalk: 0, stairs: 0, other: 0 }
  for (const segment of route.segments) totals[comfortKeyOf(segment)] += segment.distance
  return totals
}
