import type { ExpressionSpecification } from 'maplibre-gl'
import { type BandTotals, bandKm, formatBy, formatPicks, type Picks, parseBy, parsePicks, shownKm } from './bands'

/**
 * The comfort layer's filters. The pipeline bands each way on the layer by its
 * type, speed limit, lanes, bike infrastructure, surface and lighting (pipeline/comfort.mjs),
 * writes the bands into the tiles, and adds up the km of every combination
 * into meta.json for the legend's bars.
 */
export const COMFORT_GROUPS = {
  stress: ['1', '2', '3', '4'],
  type: ['path', 'residential', 'service', 'minor', 'tertiary', 'secondary', 'primary', 'trunk', 'track', 'other'],
  speed: ['30', '40', '50', '60', '70', 'unknown'],
  lanes: ['1', '2', '3', 'unknown'],
  bikeway: ['path', 'lane', 'shoulder', 'shared', 'none'],
  surface: ['paved', 'unpaved', 'unknown'],
  lit: ['yes', 'no', 'unknown'],
} as const
export type ComfortSet = keyof typeof COMFORT_GROUPS
export const COMFORT_SETS = Object.keys(COMFORT_GROUPS) as ComfortSet[]

/** The tile property each set reads. */
const PROPERTY: Record<ComfortSet, string> = {
  stress: 'lts',
  type: 'type_band',
  speed: 'speed_band',
  lanes: 'lane_band',
  bikeway: 'bike_band',
  surface: 'surface_band',
  lit: 'lit_band',
}

/** The groups picked of each set, and the row the map is coloured by. */
export interface ComfortFilters {
  /** None picked of a set shows them all. */
  picks: Picks<ComfortSet>
  /** The legend's open row; none open colours the map by stress. */
  by: ComfortSet | null
}

/** Every way on the comfort layer, by stress. */
export const DEFAULT_COMFORT_FILTERS: ComfortFilters = { picks: {}, by: 'stress' }

/** The set the map is coloured by. */
export const comfortColorBy = (f: ComfortFilters): ComfortSet => f.by ?? 'stress'

/** Whether anything is picked. */
export const comfortPicked = (f: ComfortFilters) => COMFORT_SETS.some((set) => f.picks[set]?.length)

/** A way's group in one set, as a map expression: `-` where the set does not apply (a path's lanes). */
export const comfortGroupOf = (set: ComfortSet): ExpressionSpecification => [
  'to-string',
  ['coalesce', ['get', PROPERTY[set]], '-'],
]

/** The picks as a map filter. A path has no lanes, so picking lanes leaves paths out. */
export function comfortFilter(f: ComfortFilters): ExpressionSpecification {
  const picked = COMFORT_SETS.filter((set) => f.picks[set]?.length)
  return [
    'all',
    ...picked.map((set) => ['in', comfortGroupOf(set), ['literal', [...(f.picks[set] ?? [])]]]),
  ] as unknown as ExpressionSpecification
}

/** The pipeline's km of the comfort layer for every combination of bands; `-` where a set does not apply. */
export type ComfortTotals = BandTotals

/** Km in each group of one set, under the other sets' picks and with none. */
export const comfortKm = (totals: ComfortTotals, f: ComfortFilters, set: ComfortSet) => bandKm(totals, f.picks, set)

/** Km of the comfort layer the picks show. */
export const comfortShownKm = (totals: ComfortTotals, f: ComfortFilters) => shownKm(totals, f.picks)

/**
 * In the URL as `comfort=stress:3,4;speed:60,70;by:speed`: the groups picked
 * of each set, then the row the map is coloured by unless it is stress.
 */
export function formatComfortFilters(f: ComfortFilters): string | null {
  const by = formatBy(f.by, DEFAULT_COMFORT_FILTERS.by as ComfortSet)
  return [...formatPicks(COMFORT_GROUPS, f.picks), ...(by ? [by] : [])].join(';') || null
}

export function parseComfortFilters(text: string | undefined): ComfortFilters {
  return { picks: parsePicks(COMFORT_GROUPS, text), by: parseBy(text, COMFORT_SETS, 'stress') }
}
