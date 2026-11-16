import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'
import LENGTHS from '../../pipeline/pathway-lengths.json'
import { type BandTotals, bandKm, formatPicks, type Picks, parsePicks, shownKm } from './bands'

/**
 * The pathways layer: every path bikes are not kept off, coloured by the
 * filter row open in the legend (surface at first), those without that tag in
 * yellow so they can be mapped. The pipeline bands each pathway by surface,
 * type, width and smoothness (pipeline/pathway-bands.mjs), reads its snow
 * clearing and whether it is lit,
 * and measures the island it is part of (`island_m`): all the pathways joined
 * to it, crossings included, so that short stubs can be left out.
 */

/** Each set's groups, the best first; unknown is a pathway without the tag. */
export const PATHWAY_GROUPS = {
  surface: ['asphalt', 'concrete', 'paving_stones', 'fine_gravel', 'gravel', 'ground', 'other', 'unknown'],
  type: ['cycleway', 'path', 'footway'],
  width: ['3.5', '2.5', '1.5', '0', 'unknown'],
  snow: ['yes', 'no', 'unknown'],
  smoothness: ['excellent', 'good', 'intermediate', 'bad', 'unknown'],
  lit: ['yes', 'no'],
} as const
export type PathwaySet = keyof typeof PATHWAY_GROUPS
export const PATHWAY_SETS = Object.keys(PATHWAY_GROUPS) as PathwaySet[]

export type SurfaceId = (typeof PATHWAY_GROUPS.surface)[number]
export type KnownSurfaceId = Exclude<SurfaceId, 'unknown'>
export type WidthBand = Exclude<(typeof PATHWAY_GROUPS.width)[number], 'unknown'>

/** The tile property each set reads. */
const PROPERTY: Record<PathwaySet, string> = {
  surface: 'surface_group',
  type: 'path_type',
  width: 'width_band',
  snow: 'winter',
  smoothness: 'smooth_band',
  lit: 'lit_band',
}

/** A pathway's group in one set, unknown where it is not tagged, as a map expression. */
export const pathwayGroupOf = (set: PathwaySet): ExpressionSpecification => [
  'coalesce',
  ['get', PROPERTY[set]],
  'unknown',
]

export interface PathwayFilters {
  picks: Picks<PathwaySet>
  /** Only pathways joined up into at least this much pathway, in metres. */
  minLength: number
  /** The legend's open row, which the map is coloured by; none open colours it by surface. */
  by: PathwaySet | null
}

export const DEFAULT_PATHWAY_FILTERS: PathwayFilters = { picks: {}, minLength: 300, by: 'surface' }

/** The set the map is coloured by. */
export const colorBy = (f: PathwayFilters): PathwaySet => f.by ?? 'surface'

/** Width a pathway is drawn at when its width is not tagged. */
export const UNKNOWN_WIDTH = 1.5

/** The length slider's steps, in metres: short stubs first, then whole neighbourhoods. */
export const LENGTH_STEPS: readonly number[] = LENGTHS

/** The width band of a pathway this wide, as the pipeline bands it. */
export function widthBand(metres: number): WidthBand {
  return metres < 1.5 ? '0' : metres < 2.5 ? '1.5' : metres < 3.5 ? '2.5' : '3.5'
}

/** Which pathways the filters let through. */
export function pathwayFilter(f: PathwayFilters): FilterSpecification {
  const picked = PATHWAY_SETS.filter((set) => f.picks[set]?.length)
  return [
    'all',
    ['has', 'pathway'],
    ...picked.map((set) => ['in', pathwayGroupOf(set), ['literal', [...(f.picks[set] ?? [])]]]),
    // Tiles from before islands were measured keep every pathway.
    ['>=', ['coalesce', ['get', 'island_m'], Number.MAX_SAFE_INTEGER], f.minLength],
  ] as unknown as FilterSpecification
}

/** The pipeline's km of pathway for every combination of bands and island length step. */
export type PathwayTotals = BandTotals

/** Rows of islands at least as long as the slider asks. */
const longEnough = (totals: PathwayTotals, minLength: number) => {
  const at = totals.sets.indexOf('length')
  return (row: readonly (string | number)[]) => at < 0 || Number(row[at]) >= minLength
}

/** Km in each group of one set, under the other sets' picks and with none; both as long as the slider asks. */
export const pathwayKm = (totals: PathwayTotals, f: PathwayFilters, set: PathwaySet) =>
  bandKm(totals, f.picks, set, longEnough(totals, f.minLength))

/** Km of pathway the filters show. */
export const pathwayShownKm = (totals: PathwayTotals, f: PathwayFilters) =>
  shownKm(totals, f.picks, longEnough(totals, f.minLength))

/** A length as people say it: metres up to a kilometre, then km. */
export function formatLength(metres: number, locale: string): string {
  if (metres < 1000) return `${Math.round(metres).toLocaleString(locale)} m`
  return `${(metres / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
}

/** The step nearest a length, so the slider can show it. */
export function nearestLength(metres: number): number {
  return LENGTH_STEPS.reduce((best, step) => (Math.abs(step - metres) < Math.abs(best - metres) ? step : best))
}

/**
 * In the URL as `pathways=surface:ground,gravel;width:2.5;length:1000;by:snow`:
 * the groups picked of each set, then the least island length and the row the
 * map is coloured by (`none` for none open), each unless it is the default.
 */
export function formatPathwayFilters(f: PathwayFilters): string | null {
  const d = DEFAULT_PATHWAY_FILTERS
  const parts = formatPicks(PATHWAY_GROUPS, f.picks)
  if (f.minLength !== d.minLength) parts.push(`length:${f.minLength}`)
  if (f.by !== d.by) parts.push(`by:${f.by ?? 'none'}`)
  return parts.join(';') || null
}

export function parsePathwayFilters(text: string | undefined): PathwayFilters {
  const d = DEFAULT_PATHWAY_FILTERS
  const parts = (text ?? '').split(';')
  const value = (key: string) => parts.find((part) => part.startsWith(`${key}:`))?.slice(key.length + 1)
  const metres = Number(value('length') || Number.NaN)
  const by = value('by')
  return {
    picks: parsePicks(PATHWAY_GROUPS, text),
    minLength: metres >= 0 ? nearestLength(metres) : d.minLength,
    by: by === 'none' ? null : PATHWAY_SETS.includes(by as PathwaySet) ? (by as PathwaySet) : d.by,
  }
}
