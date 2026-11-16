import type { FeatureCollection, Point } from 'geojson'
import { collisionLocation } from './collisions'

/**
 * Bikes reported stolen to the Ottawa Police Service, from its open data
 * (pipeline/fetch-thefts.mjs writes public/data/thefts.geojson). The police
 * place each theft at the nearest intersection, so thefts gather at them.
 */

/** The years in the data, by when the bike was taken. */
export const THEFT_YEARS = { first: 2018, last: 2025, missing: [] as readonly number[] }

/**
 * What each theft is sorted by: where the bike was taken from, the time of
 * day, the season, the kind of bike and its value. Value groups start at
 * their lowest value in dollars.
 */
export const THEFT_GROUPS = {
  where: ['outdoors', 'home', 'building', 'other'],
  time: ['morning', 'afternoon', 'evening', 'night'],
  season: ['winter', 'spring', 'summer', 'fall'],
  type: ['mountain', 'hybrid', 'road', 'city', 'kids', 'other'],
  value: ['0', '500', '1000', '2500', 'unknown'],
} as const
export type TheftGroupId = keyof typeof THEFT_GROUPS
export const THEFT_GROUP_IDS = Object.keys(THEFT_GROUPS) as TheftGroupId[]

export interface TheftProps {
  id: number
  /** The day it was taken, as reported: YYYY-MM-DD. */
  date: string
  /** The hour it was taken, 0 to 23: often a guess, such as overnight. */
  hour?: number
  time?: string
  where: string
  type: string
  make?: string
  /** Dollars, as reported. */
  value?: number
  /** Found again since. */
  recovered?: boolean
  /** The nearest intersection, as the police write it: "MACLAREN ST, METCALFE ST". */
  place?: string
  /** The neighbourhood. */
  area?: string
}

/** Which group of a set a theft falls in. */
/** The season of each month, January first: winter is December to February. */
const SEASON_OF_MONTH = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'fall',
  'fall',
  'fall',
  'winter',
]

export function theftGroupOf(p: TheftProps, id: TheftGroupId): string {
  if (id === 'season') return SEASON_OF_MONTH[Number(p.date.slice(5, 7)) - 1] ?? 'other'
  if (id === 'value') {
    const v = p.value ?? 0
    return v <= 0 ? 'unknown' : v >= 2500 ? '2500' : v >= 1000 ? '1000' : v >= 500 ? '500' : '0'
  }
  const value = p[id] ?? ''
  return (THEFT_GROUPS[id] as readonly string[]).includes(value) ? value : 'other'
}

export interface TheftFilters {
  from: number
  to: number
  /** Only spots with at least this many thefts: where bikes keep going missing. */
  minCount: number
  /** Only these groups of each set; a set left out keeps them all. */
  groups: Partial<Record<TheftGroupId, readonly string[]>>
}

export const DEFAULT_THEFT_FILTERS: TheftFilters = {
  from: THEFT_YEARS.first,
  to: THEFT_YEARS.last,
  minCount: 1,
  groups: {},
}

const yearOf = (p: TheftProps) => Number(p.date.slice(0, 4))

export function matchesTheft(p: TheftProps, f: TheftFilters): boolean {
  const year = yearOf(p)
  if (year < f.from || year > f.to) return false
  return THEFT_GROUP_IDS.every((id) => {
    const picked = f.groups[id]
    return !picked?.length || picked.includes(theftGroupOf(p, id))
  })
}

/**
 * How the thefts split over one set's groups: `shown` under every filter but
 * that set's own, so its other groups stay to be picked; `all` for the years
 * picked alone, to compare with.
 */
export function theftGroupCounts(
  all: readonly TheftProps[],
  f: TheftFilters,
  id: TheftGroupId,
): { shown: Map<string, number>; all: Map<string, number> } {
  const others = { ...f, groups: { ...f.groups, [id]: [] } }
  const base = { ...f, groups: {} }
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const p of all) {
    if (!matchesTheft(p, base)) continue
    const group = theftGroupOf(p, id)
    every.set(group, (every.get(group) ?? 0) + 1)
    if (matchesTheft(p, others)) shown.set(group, (shown.get(group) ?? 0) + 1)
  }
  return { shown, all: every }
}

/** Thefts by month (`2019-06`), under every filter but the years, so the years left out still show. */
export function theftsByMonth(all: readonly TheftProps[], f: TheftFilters): Map<string, number> {
  const everyYear = { ...f, from: THEFT_YEARS.first, to: THEFT_YEARS.last }
  const counts = new Map<string, number>()
  for (const p of all) {
    if (!matchesTheft(p, everyYear)) continue
    const month = p.date.slice(0, 7)
    counts.set(month, (counts.get(month) ?? 0) + 1)
  }
  return counts
}

/**
 * In the URL as `thefts=2019-2024;5;where:outdoors.value:1000,2500` (the
 * years, the fewest thefts a spot needs, the groups picked), each part left
 * out when it is the default.
 */
export function formatTheftFilters(f: TheftFilters): string | null {
  const d = DEFAULT_THEFT_FILTERS
  const parts = [
    f.from === d.from && f.to === d.to ? '' : `${f.from}-${f.to}`,
    f.minCount === d.minCount ? '' : String(f.minCount),
    THEFT_GROUP_IDS.filter((id) => f.groups[id]?.length)
      .map((id) => `${id}:${f.groups[id]?.join(',')}`)
      .join('.'),
  ]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseTheftFilters(text: string | undefined): TheftFilters {
  const d = DEFAULT_THEFT_FILTERS
  const [yearText, minText, groupText] = (text ?? '').split(';')
  const [from, to] = (yearText ?? '').split('-').map(Number)
  const inRange = (y: number) => Number.isInteger(y) && y >= THEFT_YEARS.first && y <= THEFT_YEARS.last
  const years = inRange(from) && inRange(to) && from <= to ? { from, to } : { from: d.from, to: d.to }
  const groups: TheftFilters['groups'] = {}
  for (const part of (groupText ?? '').split('.')) {
    const [id, values = ''] = part.split(':')
    if (!THEFT_GROUP_IDS.includes(id as TheftGroupId)) continue
    const known: readonly string[] = THEFT_GROUPS[id as TheftGroupId]
    const picked = values.split(',').filter((v) => known.includes(v))
    if (picked.length) groups[id as TheftGroupId] = picked
  }
  return {
    ...years,
    minCount: Number.isInteger(Number(minText)) && Number(minText) >= 1 ? Number(minText) : d.minCount,
    groups,
  }
}

/** "MACLAREN ST, METCALFE ST" → "Maclaren St & Metcalfe St"; a distance stays after a comma ("Laurier Ave, 89 m E of Waller St"). */
export function theftPlace(text: string): string {
  return collisionLocation(text.replace(/, (?=\D)/g, ' @ '), 'between')
    .replace(/\b(\d+) ?m\b/g, '$1 m')
    .replace(/\bOf\b/g, 'of')
}

/** A theft and where the police placed it. */
export interface Theft {
  props: TheftProps
  at: [number, number]
}

/** An intersection where bikes were taken. */
export interface TheftSpot {
  key: string
  at: [number, number]
  /** The most recent first. */
  items: TheftProps[]
}

/** The thefts that pass the filters, by intersection: the police put each at one, so they share its point. */
export function theftSpots(all: readonly Theft[], f: TheftFilters): TheftSpot[] {
  const byPoint = new Map<string, TheftSpot>()
  for (const t of all) {
    if (!matchesTheft(t.props, f)) continue
    const key = t.at.join(',')
    const spot = byPoint.get(key)
    if (spot) spot.items.push(t.props)
    else byPoint.set(key, { key, at: t.at, items: [t.props] })
  }
  const spots = [...byPoint.values()]
  for (const spot of spots) spot.items.sort((a, b) => b.date.localeCompare(a.date))
  return spots
}

/** Spots for the map: bigger ones first, so smaller ones are drawn on top of them. */
export function theftSpotsGeoJSON(spots: readonly TheftSpot[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: [...spots]
      .sort((a, b) => b.items.length - a.items.length)
      .map((spot) => ({
        type: 'Feature',
        properties: { key: spot.key, count: spot.items.length },
        geometry: { type: 'Point', coordinates: spot.at },
      })),
  }
}
