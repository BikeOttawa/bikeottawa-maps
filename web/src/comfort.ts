import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * The comfort layer's filters. The pipeline bands each way on the layer by its
 * speed limit, lanes, bike infrastructure and surface (pipeline/comfort.mjs),
 * writes the bands into the tiles, and adds up the km of every combination
 * into meta.json for the legend's bars.
 */
export const COMFORT_GROUPS = {
  stress: ['1', '2', '3', '4'],
  speed: ['30', '40', '50', '60', '70', 'unknown'],
  lanes: ['1', '2', '3', 'unknown'],
  bikeway: ['path', 'lane', 'shoulder', 'shared', 'none'],
  surface: ['paved', 'unpaved', 'unknown'],
} as const
export type ComfortSet = keyof typeof COMFORT_GROUPS
export const COMFORT_SETS = Object.keys(COMFORT_GROUPS) as ComfortSet[]

/** The tile property each set reads. */
const PROPERTY: Record<ComfortSet, string> = {
  stress: 'lts',
  speed: 'speed_band',
  lanes: 'lane_band',
  bikeway: 'bike_band',
  surface: 'surface_band',
}

/** The groups picked of each set; none picked shows them all. */
export type ComfortFilters = Partial<Record<ComfortSet, readonly string[]>>

/** Every way on the comfort layer. */
export const DEFAULT_COMFORT_FILTERS: ComfortFilters = {}

/** The picks as a map filter. A path has no speed or lanes, so picking either leaves paths out. */
export function comfortFilter(f: ComfortFilters): ExpressionSpecification {
  const picked = COMFORT_SETS.filter((set) => f[set]?.length)
  return [
    'all',
    ...picked.map((set) => ['in', ['to-string', ['get', PROPERTY[set]]], ['literal', [...(f[set] ?? [])]]]),
  ] as unknown as ExpressionSpecification
}

/** The pipeline's km of the comfort layer for every combination of bands; `-` where a set does not apply. */
export interface ComfortTotals {
  sets: readonly string[]
  rows: readonly (string | number)[][]
}

function picksMatch(totals: ComfortTotals, row: readonly (string | number)[], f: ComfortFilters, skip?: ComfortSet) {
  return COMFORT_SETS.every((set) => {
    const picked = f[set]
    if (set === skip || !picked?.length) return true
    return picked.includes(String(row[totals.sets.indexOf(set)]))
  })
}

/**
 * Km in each group of one set: `shown` under the other sets' picks, so this
 * set's other groups stay to be picked; `all` with nothing picked. Ways a set
 * does not apply to (paths, for speed and lanes) are left out of its bars.
 */
export function comfortKm(
  totals: ComfortTotals,
  f: ComfortFilters,
  set: ComfortSet,
): { shown: Map<string, number>; all: Map<string, number> } {
  const at = totals.sets.indexOf(set)
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const row of totals.rows) {
    const group = String(row[at])
    if (group === '-') continue
    const km = Number(row.at(-1))
    every.set(group, (every.get(group) ?? 0) + km)
    if (picksMatch(totals, row, f, set)) shown.set(group, (shown.get(group) ?? 0) + km)
  }
  return { shown, all: every }
}

/** Km of the comfort layer the picks show. */
export function comfortShownKm(totals: ComfortTotals, f: ComfortFilters): number {
  return totals.rows.reduce((sum, row) => (picksMatch(totals, row, f) ? sum + Number(row.at(-1)) : sum), 0)
}

/** In the URL as `comfort=stress:3,4.speed:60,70`: the groups picked of each set. */
export function formatComfortFilters(f: ComfortFilters): string | null {
  const parts = COMFORT_SETS.filter((set) => f[set]?.length).map((set) => `${set}:${f[set]?.join(',')}`)
  return parts.length ? parts.join('.') : null
}

export function parseComfortFilters(text: string | undefined): ComfortFilters {
  const f: ComfortFilters = {}
  for (const part of (text ?? '').split('.')) {
    const [set, values = ''] = part.split(':')
    if (!COMFORT_SETS.includes(set as ComfortSet)) continue
    const known: readonly string[] = COMFORT_GROUPS[set as ComfortSet]
    const picked = values.split(',').filter((v) => known.includes(v))
    if (picked.length) f[set as ComfortSet] = picked
  }
  return f
}
