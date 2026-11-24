import type { ExpressionSpecification } from 'maplibre-gl'
import { formatBy, parseBy } from './bands'

/**
 * Construction: the city's forecast of capital works, roads, sewers, cycling,
 * bridges, transit, for the Projects layer (the region's
 * pipeline/fetch-construction.mjs writes tiles/construction.geojson each
 * night). Today's closures are apart, in roadwork/.
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
