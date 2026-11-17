import type { FeatureCollection, Point } from 'geojson'
import { formatBy, parseBy } from './bands'
import { collisionLocation } from './collisions'
import { HUES, OTHER, SEASON_HUES } from './layers'
import { SEASONS, seasonOf } from './seasons'

/**
 * Bikes reported stolen to the Ottawa Police Service, from its open data
 * (pipeline/fetch-thefts.mjs writes public/data/thefts.geojson). The police
 * place each theft at the nearest intersection, so thefts gather at them.
 */

/** The years in the data, by when the bike was taken. */
export const THEFT_YEARS = { first: 2018, last: 2025, missing: [] as readonly number[] }

/**
 * What each theft is sorted by: where the bike was taken from, the time of
 * day, the season, the kind of bike, its value, and whether it was found
 * again. Value groups start at their lowest value in dollars.
 */
export const THEFT_GROUPS = {
  where: ['outdoors', 'home', 'building', 'other'],
  time: ['morning', 'afternoon', 'evening', 'night'],
  season: SEASONS,
  type: ['mountain', 'hybrid', 'road', 'city', 'kids', 'other'],
  value: ['0', '500', '1000', '2500', 'unknown'],
  recovered: ['yes', 'no'],
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
  model?: string
  /** Its colours, as the card names them: black, grey, red… */
  colour?: string[]
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
export function theftGroupOf(p: TheftProps, id: TheftGroupId): string {
  if (id === 'season') return seasonOf(p.date)
  if (id === 'recovered') return p.recovered ? 'yes' : 'no'
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
  /** Only spots where at least this many dollars were stolen: one of VALUE_STOPS. */
  minValue: number
  /** Only these groups of each set; a set left out keeps them all. */
  groups: Partial<Record<TheftGroupId, readonly string[]>>
  /** The legend's open row, which colours the spots; none open, as at first, colours them by the value stolen. */
  by: TheftGroupId | null
}

export const DEFAULT_THEFT_FILTERS: TheftFilters = {
  from: THEFT_YEARS.first,
  to: THEFT_YEARS.last,
  minCount: 1,
  minValue: 0,
  groups: {},
  by: null,
}

/** Values are ordered, so one purple from light to dark; the other sets take the categorical hues. */
const VALUE_HUES = ['#D9C3EC', '#B48AD6', '#8A55B8', '#5B2A85']

/** A group's colour, in the legend and on the spots. */
export function theftGroupColor(id: TheftGroupId, group: string): string {
  if (group === 'other' || group === 'unknown') return OTHER
  if (id === 'season') return SEASON_HUES[group] ?? OTHER
  // Found again green, still missing orange.
  if (id === 'recovered') return group === 'yes' ? HUES[2] : HUES[1]
  const index = (THEFT_GROUPS[id] as readonly string[]).indexOf(group)
  return (id === 'value' ? VALUE_HUES[index] : HUES[index]) ?? OTHER
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
 * In the URL as `thefts=2019-2024;5;where:outdoors.value:1000,2500;5000;by:time`
 * (the years, the fewest thefts a spot needs, the groups picked, the least
 * value stolen there, the row the spots are coloured by), each part left out
 * when it is the default.
 */
export function formatTheftFilters(f: TheftFilters): string | null {
  const d = DEFAULT_THEFT_FILTERS
  const parts = [
    f.from === d.from && f.to === d.to ? '' : `${f.from}-${f.to}`,
    f.minCount === d.minCount ? '' : String(f.minCount),
    THEFT_GROUP_IDS.filter((id) => f.groups[id]?.length)
      .map((id) => `${id}:${f.groups[id]?.join(',')}`)
      .join('.'),
    f.minValue === d.minValue ? '' : String(f.minValue),
    formatBy(f.by, null) ?? '',
  ]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseTheftFilters(text: string | undefined): TheftFilters {
  const d = DEFAULT_THEFT_FILTERS
  const [yearText, minText, groupText, valueText] = (text ?? '').split(';')
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
    minValue: (VALUE_STOPS as readonly number[]).includes(Number(valueText)) ? Number(valueText) : d.minValue,
    groups,
    by: parseBy(text, THEFT_GROUP_IDS, null),
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
  /** Dollars stolen there, as reported; `valued` thefts had a value given. */
  value: number
  valued: number
}

/** Where the map's colours step up, in dollars stolen at an intersection: under the first, then each up to the next. */
export const VALUE_STEPS = [1000, 5000, 10000, 25000] as const

/** The value slider's stops: where each colour step starts, and its end, past which only the worst few spots are left. */
export const VALUE_STOPS = [0, ...VALUE_STEPS, 50000] as const

/** The thefts that pass the filters, by intersection: the police put each at one, so they share its point. */
export function theftSpots(all: readonly Theft[], f: TheftFilters): TheftSpot[] {
  const byPoint = new Map<string, TheftSpot>()
  for (const t of all) {
    if (!matchesTheft(t.props, f)) continue
    const key = t.at.join(',')
    const spot = byPoint.get(key) ?? { key, at: t.at, items: [], value: 0, valued: 0 }
    byPoint.set(key, spot)
    spot.items.push(t.props)
    if (t.props.value) {
      spot.value += t.props.value
      spot.valued++
    }
  }
  const spots = [...byPoint.values()]
  for (const spot of spots) spot.items.sort((a, b) => b.date.localeCompare(a.date))
  return spots
}

/** How many of a spot's thefts fall in each group of a set, in the groups' order. */
export function spotTheftCounts(items: readonly TheftProps[], id: TheftGroupId): number[] {
  const groups: readonly string[] = THEFT_GROUPS[id]
  const counts = groups.map(() => 0)
  for (const p of items) counts[groups.indexOf(theftGroupOf(p, id))]++
  return counts
}

/** The group of a set most of a spot's thefts fall in; on a tie, the one listed first. */
export function commonTheftGroup(items: readonly TheftProps[], id: TheftGroupId): string {
  const counts = spotTheftCounts(items, id)
  return THEFT_GROUPS[id][counts.indexOf(Math.max(...counts))]
}

/**
 * Spots for the map: bigger ones first, so smaller ones are drawn on top of
 * them. Coloured by a set, each carries the group most of its thefts fall
 * in, and how many fall in each (`pie`, for big spots).
 */
export function theftSpotsGeoJSON(
  spots: readonly TheftSpot[],
  by: TheftGroupId | null = null,
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
          value: spot.value,
          valued: spot.valued,
          ...(by && { group: commonTheftGroup(spot.items, by), pie: spotTheftCounts(spot.items, by).join(',') }),
        },
        geometry: { type: 'Point', coordinates: spot.at },
      })),
  }
}
