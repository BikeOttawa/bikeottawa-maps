import type { FeatureCollection, Point } from 'geojson'
import { formatBy, parseBy } from './bands'
import { HUES, OTHER, SEASON_HUES } from './layers'
import { spotScale } from './map/pieImage'
import { SEASONS, seasonOf } from './seasons'

/**
 * Traffic collisions involving cyclists or pedestrians, from the City of
 * Ottawa's open data (the region's pipeline/fetch-collisions.mjs writes its data/collisions.geojson).
 */

/** Worst injury in the collision, least to most severe. */
export const SEVERITIES = ['none', 'minimal', 'minor', 'major', 'fatal'] as const
export type Severity = (typeof SEVERITIES)[number]

/** Who was hurt or involved, besides people in vehicles. */
export const COLLISION_PARTIES = ['bike', 'foot'] as const
export type CollisionParty = (typeof COLLISION_PARTIES)[number]

/** Whose collision it is: a cyclist's when one was involved (with a pedestrian too, in a handful), else a pedestrian's. */
export const partyOf = (p: CollisionProps): CollisionParty => (p.bicycles > 0 ? 'bike' : 'foot')

/** Cyclists and pedestrians in the first categorical hues. */
export const partyColor = (party: string): string => HUES[COLLISION_PARTIES.indexOf(party as CollisionParty)] ?? OTHER

/** The years in the data. 2023 was never published by the city. */
export const COLLISION_YEARS = { first: 2017, last: 2024, missing: [2023] } as const

/**
 * The circumstances recorded for each collision, each sorted into a few
 * groups; the city's rarer values go to `other`. The season comes from the date.
 */
export const CONDITIONS = {
  light: ['day', 'dark', 'dusk', 'dawn', 'other'],
  season: SEASONS,
  weather: ['clear', 'rain', 'snow', 'other'],
  surface: ['dry', 'wet', 'snow', 'other'],
  impact: ['angle', 'turning', 'sideswipe', 'rear', 'single', 'other'],
  control: ['signal', 'stop', 'none', 'other'],
} as const
export type ConditionId = keyof typeof CONDITIONS
export const CONDITION_IDS = Object.keys(CONDITIONS) as ConditionId[]

/** The city's values, by group. */
const CONDITION_OF: Record<Exclude<ConditionId, 'season'>, Record<string, string>> = {
  light: { Daylight: 'day', Dark: 'dark', Dusk: 'dusk', Dawn: 'dawn' },
  weather: { Clear: 'clear', Rain: 'rain', Snow: 'snow', 'Freezing Rain': 'snow', 'Drifting Snow': 'snow' },
  surface: { Dry: 'dry', Wet: 'wet', 'Loose snow': 'snow', Slush: 'snow', Ice: 'snow', 'Packed snow': 'snow' },
  impact: {
    Angle: 'angle',
    'Turning movement': 'turning',
    Sideswipe: 'sideswipe',
    'Rear end': 'rear',
    'SMV other': 'single',
    'SMV unattended vehicle': 'single',
  },
  control: { 'Traffic signal': 'signal', 'Stop sign': 'stop', 'No control': 'none' },
}

/** The legend's rows: who was involved, worst injury, then the circumstances. */
export const COLLISION_SETS = ['party', 'severity', ...CONDITION_IDS] as const
export type CollisionSet = (typeof COLLISION_SETS)[number]

/** A circumstance's groups in the categorical hues, seasons in their own; other grey. */
export function conditionColor(id: ConditionId, group: string): string {
  if (group === 'other') return OTHER
  if (id === 'season') return SEASON_HUES[group] ?? OTHER
  return HUES[(CONDITIONS[id] as readonly string[]).indexOf(group)] ?? OTHER
}

/** Which group of a circumstance a collision falls in. */
export function conditionOf(p: CollisionProps, id: ConditionId): string {
  if (id === 'season') return seasonOf(p.date)
  return CONDITION_OF[id][p[id] ?? ''] ?? 'other'
}

export interface CollisionFilters {
  parties: readonly CollisionParty[]
  from: number
  to: number
  severities: readonly Severity[]
  /** Only spots with at least this many collisions: the most dangerous places. */
  minCount: number
  /** Only these groups of each circumstance; a circumstance left out keeps them all. */
  conditions: Partial<Record<ConditionId, readonly string[]>>
  /** The legend's open row, which the spots are coloured by; none open colours them by worst injury. */
  by: CollisionSet | null
}

/** Cyclists only, every year, every injury level, in any circumstances. */
export const DEFAULT_COLLISION_FILTERS: CollisionFilters = {
  parties: ['bike'],
  from: COLLISION_YEARS.first,
  to: COLLISION_YEARS.last,
  severities: SEVERITIES,
  minCount: 1,
  conditions: {},
  by: null,
}

export interface CollisionProps {
  id: string
  year: number
  date: string
  severity: Severity
  bicycles: number
  pedestrians: number
  vehicles: number
  location?: string
  impact?: string
  light?: string
  surface?: string
  weather?: string
  control?: string
}

/** Whether a collision passes the filters. */
export function matchesCollision(p: CollisionProps, f: CollisionFilters): boolean {
  if (!f.parties.includes(partyOf(p)) || p.year < f.from || p.year > f.to || !f.severities.includes(p.severity))
    return false
  return CONDITION_IDS.every((id) => {
    const picked = f.conditions[id]
    return !picked?.length || picked.includes(conditionOf(p, id))
  })
}

/**
 * How the collisions split over one circumstance's groups: `shown` under every
 * filter but that circumstance's own, so its other groups stay to be picked;
 * `all` for the people and years picked alone, to compare with.
 */
export function conditionCounts(
  all: readonly CollisionProps[],
  f: CollisionFilters,
  id: ConditionId,
): { shown: Map<string, number>; all: Map<string, number> } {
  const others = { ...f, conditions: { ...f.conditions, [id]: [] } }
  const base = { ...f, severities: SEVERITIES, conditions: {} }
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const p of all) {
    if (!matchesCollision(p, base)) continue
    const group = conditionOf(p, id)
    every.set(group, (every.get(group) ?? 0) + 1)
    if (matchesCollision(p, others)) shown.set(group, (shown.get(group) ?? 0) + 1)
  }
  return { shown, all: every }
}

/**
 * How the collisions split between cyclists and pedestrians: `shown` under
 * every filter but who, `all` for the years picked alone.
 */
export function partyCounts(
  all: readonly CollisionProps[],
  f: CollisionFilters,
): { shown: Map<string, number>; all: Map<string, number> } {
  const everyone = { ...f, parties: COLLISION_PARTIES }
  const base = { ...everyone, severities: SEVERITIES, conditions: {} }
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const p of all) {
    if (!matchesCollision(p, base)) continue
    every.set(partyOf(p), (every.get(partyOf(p)) ?? 0) + 1)
    if (matchesCollision(p, everyone)) shown.set(partyOf(p), (shown.get(partyOf(p)) ?? 0) + 1)
  }
  return { shown, all: every }
}

/** Collisions by month (`2019-06`), under every filter but the years, so the years left out still show. */
export function countByMonth(all: readonly CollisionProps[], f: CollisionFilters): Map<string, number> {
  const everyYear = { ...f, from: COLLISION_YEARS.first, to: COLLISION_YEARS.last }
  const counts = new Map<string, number>()
  for (const p of all) {
    if (!matchesCollision(p, everyYear)) continue
    const month = p.date.slice(0, 7)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return counts
}

/** How many collisions at each injury level pass the filters (ignoring the severity filter). */
/**
 * How the collisions split by worst injury, as for a circumstance: `shown`
 * under every filter but the injuries picked, `all` for the people and years
 * picked alone.
 */
export function severityCounts(
  all: readonly CollisionProps[],
  f: CollisionFilters,
): { shown: Map<string, number>; all: Map<string, number> } {
  const map = (counts: Record<Severity, number>) => new Map(Object.entries(counts).filter(([, n]) => n > 0))
  return {
    shown: map(countBySeverity(all, f)),
    all: map(countBySeverity(all, { ...f, conditions: {} })),
  }
}

export function countBySeverity(all: readonly CollisionProps[], f: CollisionFilters): Record<Severity, number> {
  const counts = { none: 0, minimal: 0, minor: 0, major: 0, fatal: 0 }
  const everySeverity = { ...f, severities: SEVERITIES }
  for (const p of all) if (matchesCollision(p, everySeverity)) counts[p.severity]++
  return counts
}

/**
 * In the URL as `collisions=bike,foot;2019-2024;major,fatal;5;light:dark,dusk.impact:angle;by:weather`
 * (the fewest collisions a spot needs, the circumstances picked, then the row
 * the spots are coloured by), each part left out when it is the default.
 */
export function formatCollisionFilters(f: CollisionFilters): string | null {
  const d = DEFAULT_COLLISION_FILTERS
  const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v))
  const parts = [
    same(f.parties, d.parties) ? '' : f.parties.join(','),
    f.from === d.from && f.to === d.to ? '' : `${f.from}-${f.to}`,
    same(f.severities, d.severities) ? '' : f.severities.join(','),
    f.minCount === d.minCount ? '' : String(f.minCount),
    CONDITION_IDS.filter((id) => f.conditions[id]?.length)
      .map((id) => `${id}:${f.conditions[id]?.join(',')}`)
      .join('.'),
    formatBy(f.by, null) ?? '',
  ]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseCollisionFilters(text: string | undefined): CollisionFilters {
  const d = DEFAULT_COLLISION_FILTERS
  const [partyText, yearText, severityText, minText, conditionText] = (text ?? '').split(';')
  const parties = (partyText ?? '')
    .split(',')
    .filter((v): v is CollisionParty => COLLISION_PARTIES.includes(v as never))
  const severities = (severityText ?? '').split(',').filter((v): v is Severity => SEVERITIES.includes(v as never))
  const [from, to] = (yearText ?? '').split('-').map(Number)
  const inRange = (y: number) => Number.isInteger(y) && y >= COLLISION_YEARS.first && y <= COLLISION_YEARS.last
  const years = inRange(from) && inRange(to) && from <= to ? { from, to } : { from: d.from, to: d.to }
  return {
    parties: parties.length ? parties : d.parties,
    ...years,
    severities: severities.length ? severities : d.severities,
    minCount: Number.isInteger(Number(minText)) && Number(minText) >= 1 ? Number(minText) : d.minCount,
    conditions: parseConditions(conditionText),
    by: parseBy(text, COLLISION_SETS, null),
  }
}

function parseConditions(text: string | undefined): CollisionFilters['conditions'] {
  const conditions: CollisionFilters['conditions'] = {}
  for (const part of (text ?? '').split('.')) {
    const [id, values = ''] = part.split(':')
    if (!CONDITION_IDS.includes(id as ConditionId)) continue
    const known: readonly string[] = CONDITIONS[id as ConditionId]
    const picked = values.split(',').filter((v) => known.includes(v))
    if (picked.length) conditions[id as ConditionId] = picked
  }
  return conditions
}

/**
 * "ALBERT ST @ BANK ST" → "Albert St & Bank St"; "btwn" becomes the word for
 * between. The city writes locations in capitals.
 */
export function collisionLocation(text: string, between: string): string {
  return text
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(\d+)(St|Nd|Rd|Th)\b/g, (_, n: string, suffix: string) => n + suffix.toLowerCase())
    .replace(/ @ /g, ' & ')
    .replace(/\bBtwn\b/g, between)
}

/** Collisions at one spot, worst injury first, then the most recent. */
export function worstFirst<T extends { severity?: unknown; date?: unknown }>(items: readonly T[]): T[] {
  const rank = (s: unknown) => SEVERITIES.indexOf(s as Severity)
  return [...items].sort((a, b) => rank(b.severity) - rank(a.severity) || String(b.date).localeCompare(String(a.date)))
}

/** A collision and where it happened. */
export interface Collision {
  props: CollisionProps
  at: [number, number]
}

/** Collisions this close to a spot's centre, in metres, belong to it. */
export const SAME_SPOT_M = 25

/** How much each injury adds to a spot's weight in the heat map. */
const HEAT_WEIGHTS: Record<Severity, number> = { none: 0.15, minimal: 0.3, minor: 0.45, major: 0.8, fatal: 1 }

/** A place where collisions happened: often an intersection, recorded a few metres apart each time. */
export interface CollisionSpot {
  key: string
  at: [number, number]
  /** Worst injury first, then the most recent. */
  items: CollisionProps[]
  worst: Severity
  /** For the heat map: the injuries added up. */
  weight: number
}

function metresBetween([lon1, lat1]: readonly [number, number], [lon2, lat2]: readonly [number, number]): number {
  return Math.hypot((lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180), (lat2 - lat1) * 111320)
}

/**
 * The collisions that pass the filters, grouped into spots: everything within
 * SAME_SPOT_M of where a spot is centred. The city records one intersection
 * under several names (the intersection, and the street segments meeting
 * there) a few metres apart, so names are not used. The places with the most
 * collisions start spots first, so an intersection's main point gathers the
 * others around it.
 */
export function collisionSpots(all: readonly Collision[], f: CollisionFilters): CollisionSpot[] {
  // Collisions recorded at exactly the same point, busiest points first.
  const byPoint = new Map<string, Collision[]>()
  for (const c of all) {
    if (!matchesCollision(c.props, f)) continue
    const key = c.at.join(',')
    byPoint.set(key, [...(byPoint.get(key) ?? []), c])
  }
  const points = [...byPoint.values()].sort((a, b) => b.length - a.length)

  // Spots in a grid of cells about SAME_SPOT_M across, to look only at nearby ones.
  const cellDeg = SAME_SPOT_M / 111320
  const cellOf = ([lon, lat]: readonly [number, number]) => [Math.floor(lon / cellDeg), Math.floor(lat / cellDeg)]
  const grid = new Map<string, { at: [number, number]; members: Collision[] }[]>()
  const spots: { at: [number, number]; members: Collision[] }[] = []
  for (const members of points) {
    const at = members[0].at
    const [cx, cy] = cellOf(at)
    let home: (typeof spots)[number] | undefined
    for (let dx = -2; dx <= 2 && !home; dx++) {
      for (let dy = -1; dy <= 1 && !home; dy++) {
        home = grid.get(`${cx + dx},${cy + dy}`)?.find((s) => metresBetween(s.at, at) <= SAME_SPOT_M)
      }
    }
    if (home) {
      home.members.push(...members)
      continue
    }
    const spot = { at, members: [...members] }
    spots.push(spot)
    const key = `${cx},${cy}`
    grid.set(key, [...(grid.get(key) ?? []), spot])
  }

  return spots.map((spot) => {
    const items = worstFirst(spot.members.map((m) => m.props))
    return {
      key: spot.at.join(','),
      at: spot.at,
      items,
      worst: items[0].severity,
      weight: items.reduce((sum, p) => sum + HEAT_WEIGHTS[p.severity], 0),
    }
  })
}

/** Injuries worst first, as the legend lists them. */
export const SEVERITY_GROUPS: readonly Severity[] = [...SEVERITIES].reverse()

/** A legend row's groups, in its order. */
export function collisionGroups(set: CollisionSet): readonly string[] {
  return set === 'party' ? COLLISION_PARTIES : set === 'severity' ? SEVERITY_GROUPS : CONDITIONS[set]
}

/** Which group of a legend row a collision falls in. */
function groupOf(p: CollisionProps, set: CollisionSet): string {
  return set === 'party' ? partyOf(p) : set === 'severity' ? p.severity : conditionOf(p, set)
}

/** How many of a spot's collisions fall in each group of a legend row, in its order. */
export function spotGroupCounts(items: readonly CollisionProps[], set: CollisionSet): number[] {
  const groups = collisionGroups(set)
  const counts = groups.map(() => 0)
  for (const p of items) counts[groups.indexOf(groupOf(p, set))]++
  return counts
}

/**
 * Spots for the map, sized against the busiest (`scale`), with their worst
 * injury as a rank (`worst`, as in SEVERITIES) and, coloured by a legend row,
 * how many collisions fall in each of its groups (`p0`, `p1`…): numbers, so
 * merged spots add them up.
 */
export function spotsGeoJSON(
  spots: readonly CollisionSpot[],
  by: CollisionSet | null = null,
  busiest = 1,
): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [...spots]
      .sort((a, b) => b.items.length - a.items.length)
      .map((spot) => ({
        type: 'Feature',
        properties: {
          key: spot.key,
          count: spot.items.length,
          scale: spotScale(busiest),
          worst: SEVERITIES.indexOf(spot.worst),
          weight: spot.weight,
          ...(by && Object.fromEntries(spotGroupCounts(spot.items, by).map((n, i) => [`p${i}`, n]))),
        },
        geometry: { type: 'Point', coordinates: spot.at },
      })),
  }
}
