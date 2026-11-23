import type { FeatureCollection, LineString, MultiLineString } from 'geojson'
import type { Region } from '../../../regions/region.mjs'
import { type Lang, translator } from '../i18n'

/**
 * Roadwork: what is closed right now, for the Roadwork overlay and a route's
 * card. Each service that publishes closures has a source in sources/, which
 * reads it into the one shape here; a region names the sources it uses in its
 * region.json (`roadwork`).
 */

/** A closure, whatever service it came from: what is closed, from when to when. */
export interface Closure {
  /** Its id at its source; the source's name is put before it: `ottawa-26267`. */
  id: string
  /** Where its cone goes: the closure's point, or the middle of its stretch (middleOf). */
  at: [lon: number, lat: number]
  /** The stretch it covers, where the source gives one. */
  line?: LineString | MultiLineString
  /** Its title on the card, in the language asked for. */
  headline: string
  /** The longer text under it; empty if there is none. */
  message: string
  /** The street: "Clare". */
  street?: string
  /** Which lanes, in the source's words: "closed", "1 Right Lane(s)". */
  lanes?: string
  /** The way round. */
  detour?: string
  /** First start and last end, as local date-times (2026-03-23T06:00). */
  start?: string
  end?: string
  /** Who reported it, as the card shows it: "City of Ottawa". */
  by?: string
  /** A page about it, where there is one. */
  url?: string
}

/** What a source is asked for: the closures in the region's box, in the language shown. */
export interface RoadworkAsk {
  bbox: Region['bbox']
  lang: Lang
  signal: AbortSignal
}

/**
 * A source: the default export of a file in sources/. It asks its service
 * from the browser, so the service must let any website read it (CORS), and
 * should be asked for the box only where it can be.
 */
export type RoadworkSource = (ask: RoadworkAsk) => Promise<Closure[]>

/** Whose data a source reads, for the map's credits: the file's `credit` export. */
export interface RoadworkCredit {
  name: string
  url: string
}

/** A service's JSON answer. */
export async function getJson<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

/** The point halfway along a stretch, by distance: where the cone goes. */
export function middleOf(line: LineString | MultiLineString): [number, number] {
  const parts = line.type === 'LineString' ? [line.coordinates] : line.coordinates
  // A degree of longitude is shorter than one of latitude, by the cosine of the latitude.
  const kx = Math.cos((parts[0][0][1] * Math.PI) / 180)
  const length = (a: number[], b: number[]) => Math.hypot((b[0] - a[0]) * kx, b[1] - a[1])
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

/** A closure's bubble on a route says what it is in at most this many characters a line. */
const SUMMARY_MAX = 48

/** Text cut at a word to fit SUMMARY_MAX, ending in … where cut. */
function shorten(text: string): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  if (flat.length <= SUMMARY_MAX) return flat
  const cut = flat.slice(0, SUMMARY_MAX - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > 0 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')}…`
}

/**
 * A closure in two lines, for its bubble on the route: the street and what is
 * closed there ("Clare : closed"), else its headline; then until when.
 */
export function closureSummary(closure: Closure, lang: Lang): string {
  const t = translator(lang)
  const what =
    closure.street && closure.lanes
      ? `${closure.street}${t('colon')}${closure.lanes}`
      : shorten(closure.headline || closure.message)
  const end = closure.end ? new Date(closure.end) : null
  if (!end || Number.isNaN(end.getTime())) return what
  const day = end.toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { month: 'short', day: 'numeric' })
  return `${what}\n${t('closureUntil').replace('{date}', day)}`
}
