import type { FeatureCollection, Point } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Construction: the City of Ottawa's forecast of capital works, roads, sewers,
 * cycling, bridges, transit, for the Projects layer (pipeline/fetch-construction.mjs
 * writes tiles/construction.geojson each night); and the closures on its
 * traffic map right now, fetched live, for the Roadwork overlay.
 */

/** When the work happens: under way, starting this year, in one to two years, in two to three. */
export const CONSTRUCTION_TIMINGS = ['now', 'thisYear', 'soon', 'later'] as const
export type ConstructionTiming = (typeof CONSTRUCTION_TIMINGS)[number]

/** What kind of work: cycling and walking, roads, sewers and water, bridges and culverts, transit, the rest. */
export const CONSTRUCTION_KINDS = ['cycling', 'roads', 'water', 'bridges', 'transit', 'other'] as const
export type ConstructionKind = (typeof CONSTRUCTION_KINDS)[number]

export interface ConstructionFilters {
  timings: readonly ConstructionTiming[]
  kinds: readonly ConstructionKind[]
}

/** Every timing, and every kind but buildings, parks and the like, which rarely touch a ride. */
export const DEFAULT_CONSTRUCTION_FILTERS: ConstructionFilters = {
  timings: CONSTRUCTION_TIMINGS,
  kinds: CONSTRUCTION_KINDS.filter((kind) => kind !== 'other'),
}

/** The same choice as a map filter on the projects. */
export function constructionFilter(f: ConstructionFilters): ExpressionSpecification {
  return [
    'all',
    ['in', ['get', 'timing'], ['literal', [...f.timings]]],
    ['in', ['get', 'kind'], ['literal', [...f.kinds]]],
  ] as unknown as ExpressionSpecification
}

const same = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((v) => b.includes(v))

/**
 * In the URL as `construction=now,thisYear;cycling,roads` (the timings, then
 * the kinds), each part left out when it is the default.
 */
export function formatConstructionFilters(f: ConstructionFilters): string | null {
  const d = DEFAULT_CONSTRUCTION_FILTERS
  const parts = [same(f.timings, d.timings) ? '' : f.timings.join(','), same(f.kinds, d.kinds) ? '' : f.kinds.join(',')]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseConstructionFilters(text: string | undefined): ConstructionFilters {
  const d = DEFAULT_CONSTRUCTION_FILTERS
  const [timingText, kindText] = (text ?? '').split(';')
  const timings = (timingText ?? '')
    .split(',')
    .filter((v): v is ConstructionTiming => CONSTRUCTION_TIMINGS.includes(v as never))
  const kinds = (kindText ?? '')
    .split(',')
    .filter((v): v is ConstructionKind => CONSTRUCTION_KINDS.includes(v as never))
  return {
    timings: timings.length ? timings : d.timings,
    kinds: kinds.length ? kinds : d.kinds,
  }
}

/** A closure on the City's traffic map: a road, lane or path closed now, and until when. */
export interface Closure {
  id: number
  at: [number, number]
  headline: string
  message: string
  /** Which lanes, in the City's words: "closed", "1 Right Lane(s)". */
  lanes?: string
  /** First start and last end of its schedule, as local date-times (2026-03-23T06:00). */
  start?: string
  end?: string
  /** Who reported it: CITY, MTO, NCC, GATINEAU, LRT… */
  source?: string
}

/** The City's live traffic map, in English or French. Its server lets any website read it. */
export const CLOSURES_URL = 'https://traffic.ottawa.ca/map/service/events'

interface RawEvent {
  id: number
  headline?: string
  message?: string
  lanes?: string
  generation_source?: string
  schedule?: { startDateTime?: string; endDateTime?: string }[]
  geodata?: { type?: string; coordinates?: string | number[] }
}

/** The closures in the traffic map's answer: those with a place on the map. */
export function parseClosures(json: { events?: RawEvent[] }): Closure[] {
  const closures: Closure[] = []
  for (const event of json.events ?? []) {
    const raw = event.geodata?.coordinates
    let at: unknown
    try {
      at = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      continue
    }
    if (!Array.isArray(at) || at.length < 2 || !at.every(Number.isFinite)) continue
    const starts = (event.schedule ?? []).map((s) => s.startDateTime).filter((s): s is string => Boolean(s))
    const ends = (event.schedule ?? []).map((s) => s.endDateTime).filter((s): s is string => Boolean(s))
    closures.push({
      id: event.id,
      at: [at[0], at[1]],
      headline: (event.headline ?? '').trim(),
      message: (event.message ?? '').trim(),
      lanes: event.lanes?.trim() || undefined,
      start: starts.sort()[0],
      end: ends.sort().at(-1),
      source: event.generation_source,
    })
  }
  return closures
}

/** Closures for the map: a point each, with its id. */
export function closuresGeoJSON(closures: readonly Closure[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: closures.map((c) => ({
      type: 'Feature',
      properties: { id: c.id },
      geometry: { type: 'Point', coordinates: c.at },
    })),
  }
}
