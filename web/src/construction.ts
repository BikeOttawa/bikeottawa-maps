import type { FeatureCollection, LineString, MultiLineString } from 'geojson'
import type { ExpressionSpecification } from 'maplibre-gl'
import { formatBy, parseBy } from './bands'

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

/** The legend's rows: when the work happens and what kind it is. */
export const CONSTRUCTION_SETS = ['timing', 'kind'] as const
export type ConstructionSet = (typeof CONSTRUCTION_SETS)[number]

/** The groups picked of each set; none picked shows them all, as on the other layers' filters. */
export interface ConstructionFilters {
  timings: readonly ConstructionTiming[]
  kinds: readonly ConstructionKind[]
  /** The legend's open row, which the map is coloured by; none open colours it by when. */
  by: ConstructionSet | null
}

export const DEFAULT_CONSTRUCTION_FILTERS: ConstructionFilters = { timings: [], kinds: [], by: 'timing' }

/** The set the map is coloured by. */
export const constructionColorBy = (f: ConstructionFilters): ConstructionSet => f.by ?? 'timing'

/** A project as the map and the legend read it. */
export interface ConstructionProps {
  id: string
  kind: ConstructionKind
  timing: ConstructionTiming
  type?: string
  typeFr?: string
  impacts?: string
  notes?: string
  metres?: number
  url?: string
  urlFr?: string
}

/** The same choice as a map filter on the projects. */
export function constructionFilter(f: ConstructionFilters): ExpressionSpecification {
  return [
    'all',
    f.timings.length ? ['in', ['get', 'timing'], ['literal', [...f.timings]]] : true,
    f.kinds.length ? ['in', ['get', 'kind'], ['literal', [...f.kinds]]] : true,
  ] as unknown as ExpressionSpecification
}

/**
 * How the projects split over one set: `shown` under the other set's picks,
 * so this set's other groups stay to be picked; `all` with nothing picked.
 */
export function constructionCounts(
  all: readonly ConstructionProps[],
  f: ConstructionFilters,
  set: 'timing' | 'kind',
): { shown: Map<string, number>; all: Map<string, number> } {
  const others = set === 'timing' ? f.kinds : f.timings
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const p of all) {
    const group = p[set]
    every.set(group, (every.get(group) ?? 0) + 1)
    const other: string = set === 'timing' ? p.kind : p.timing
    if (!others.length || (others as readonly string[]).includes(other)) shown.set(group, (shown.get(group) ?? 0) + 1)
  }
  return { shown, all: every }
}

/** How many projects the picks show. */
export function constructionShown(all: readonly ConstructionProps[], f: ConstructionFilters): number {
  return all.filter(
    (p) => (!f.timings.length || f.timings.includes(p.timing)) && (!f.kinds.length || f.kinds.includes(p.kind)),
  ).length
}

/**
 * In the URL as `construction=now,thisYear;cycling,roads;by:kind` (the timings
 * picked, then the kinds, then the row the map is coloured by unless it is
 * when), each part left out when it is empty.
 */
export function formatConstructionFilters(f: ConstructionFilters): string | null {
  const parts = [f.timings.join(','), f.kinds.join(',')]
  const by = formatBy(f.by, 'timing')
  if (by) parts.push(by)
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parseConstructionFilters(text: string | undefined): ConstructionFilters {
  const [timingText, kindText] = (text ?? '').split(';')
  return {
    timings: (timingText ?? '')
      .split(',')
      .filter((v): v is ConstructionTiming => CONSTRUCTION_TIMINGS.includes(v as never)),
    kinds: (kindText ?? '').split(',').filter((v): v is ConstructionKind => CONSTRUCTION_KINDS.includes(v as never)),
    by: parseBy(text, CONSTRUCTION_SETS, 'timing'),
  }
}

/**
 * A closure: on the City of Ottawa's traffic map, or roadwork on Quebec's
 * provincial roads (Québec 511). What is closed, from when to when.
 */
export interface Closure {
  /** Its source and that source's id: `ottawa-26267`, `quebec-171243`. */
  id: string
  /** Where its cone goes: the closure's point, or the middle of its stretch. */
  at: [number, number]
  /** The stretch it covers, where the source gives one. */
  line?: LineString | MultiLineString
  headline: string
  message: string
  /** Which lanes, in the City's words: "closed", "1 Right Lane(s)". */
  lanes?: string
  /** The way round, as Quebec gives it. */
  detour?: string
  /** First start and last end, as local date-times (2026-03-23T06:00). */
  start?: string
  end?: string
  /** Who reported it: CITY, MTO, NCC, GATINEAU, LRT… or QUEBEC. */
  source?: string
  /** A page about it, where there is one. */
  url?: string
}

/** The City's live traffic map, in English or French. Its server lets any website read it. */
export const CLOSURES_URL = 'https://traffic.ottawa.ca/map/service/events'

/**
 * Quebec's roadwork on the roads the province runs (autoroutes, numbered
 * routes, the Macdonald-Cartier bridge), within a box [west, south, east,
 * north]: the province's whole list is a hundred times more. Its server also
 * lets any website read it.
 */
export function quebecRoadworkUrl([west, south, east, north]: readonly number[]): string {
  return (
    'https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature' +
    '&typename=ms:chantiers_mtmdet&srsname=EPSG:4326&outputformat=geojson' +
    `&bbox=${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`
  )
}

interface RawEvent {
  id: number
  headline?: string
  message?: string
  lanes?: string
  generation_source?: string
  schedule?: { startDateTime?: string; endDateTime?: string }[]
  geodata?: { type?: string; coordinates?: string | number[] }
}

/** The closures in the City of Ottawa traffic map's answer: those with a place on the map. */
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
      id: `ottawa-${event.id}`,
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

interface QuebecWork {
  geometry: LineString | MultiLineString | null
  properties: {
    identifiant?: string | number
    descriptionFrancais?: string
    descriptionAnglais?: string
    identificationDesTravaux?: string
    detoursEtItinerairesFacultatifs?: string
    debut?: string
    fin?: string
    urlFrancais?: string
  }
}

/** "2026/08/24 07:00:00" → "2026-08-24T07:00". */
const quebecTime = (text?: string) => {
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/.exec(text ?? '')
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : undefined
}

/** The point halfway along a stretch, by distance: where the cone goes. */
function middleOf(line: LineString | MultiLineString): [number, number] {
  const parts = line.type === 'LineString' ? [line.coordinates] : line.coordinates
  // Close enough at Ottawa's latitude: a degree of longitude is about 0.7 of one of latitude.
  const length = (a: number[], b: number[]) => Math.hypot((b[0] - a[0]) * 0.7, b[1] - a[1])
  const segments = parts.flatMap((part) => part.slice(1).map((b, i) => [part[i], b]))
  const total = segments.reduce((sum, [a, b]) => sum + length(a, b), 0)
  let left = total / 2
  for (const [a, b] of segments) {
    const step = length(a, b)
    if (left <= step && step > 0) {
      const t = left / step
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]
    }
    left -= step
  }
  const [x, y] = parts[0][0]
  return [x, y]
}

/**
 * Quebec's roadwork as closures. Its descriptions come in French and English,
 * a line each for the work, where, which way, what is closed and the detour:
 * the work heads the card, the rest is its text.
 */
export function parseQuebecRoadwork(json: { features?: QuebecWork[] }, lang: 'en' | 'fr'): Closure[] {
  const closures: Closure[] = []
  for (const work of json.features ?? []) {
    const { geometry: line, properties: p } = work
    if (!line || (line.type !== 'LineString' && line.type !== 'MultiLineString')) continue
    const text = (lang === 'fr' ? p.descriptionFrancais : p.descriptionAnglais) || p.descriptionFrancais || ''
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const detour = (p.detoursEtItinerairesFacultatifs ?? '').replace(/\s+/g, ' ').trim()
    closures.push({
      id: `quebec-${p.identifiant}`,
      at: middleOf(line),
      line,
      headline: lines[0] ?? p.identificationDesTravaux ?? '',
      message: lines.slice(1).join('\n'),
      // The detour is in the text already; only French gives it apart.
      detour: lang === 'fr' && detour ? detour : undefined,
      start: quebecTime(p.debut),
      end: quebecTime(p.fin),
      source: 'QUEBEC',
      url: /^https?:\/\//i.test(p.urlFrancais ?? '') ? p.urlFrancais : undefined,
    })
  }
  return closures
}

/** Closures for the map: a cone each, and the stretch it covers where there is one, both with its id. */
export function closuresGeoJSON(closures: readonly Closure[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: [
      ...closures.flatMap((c) =>
        c.line ? [{ type: 'Feature' as const, properties: { id: c.id }, geometry: c.line }] : [],
      ),
      ...closures.map((c) => ({
        type: 'Feature' as const,
        properties: { id: c.id },
        geometry: { type: 'Point' as const, coordinates: c.at },
      })),
    ],
  }
}
