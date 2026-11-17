/**
 * Filters by bands, shared by the comfort and pathways layers. The pipeline
 * sorts each way into a few bands per set, writes them into the tiles for the
 * map to filter by, and adds up the km of every combination into meta.json, so
 * the legend's bars can count any choice of picks.
 */

/** Km for every combination of bands: a column per set, then the km. */
export interface BandTotals {
  sets: readonly string[]
  rows: readonly (string | number)[][]
}

/** The groups picked of each set; none picked shows them all. */
export type Picks<S extends string> = Partial<Record<S, readonly string[]>>

/** Which rows count at all, whatever is picked. */
type Keep = (row: readonly (string | number)[]) => boolean

function picksMatch<S extends string>(
  totals: BandTotals,
  row: readonly (string | number)[],
  picks: Picks<S>,
  skip?: S,
): boolean {
  return (Object.keys(picks) as S[]).every((set) => {
    const picked = picks[set]
    if (set === skip || !picked?.length) return true
    return picked.includes(String(row[totals.sets.indexOf(set)]))
  })
}

/**
 * Km in each group of one set: `shown` under the other sets' picks, so this
 * set's other groups stay to be picked; `all` with nothing picked. Rows where
 * the set does not apply (`-`) are left out of its bars.
 */
export function bandKm<S extends string>(
  totals: BandTotals,
  picks: Picks<S>,
  set: S,
  keep: Keep = () => true,
): { shown: Map<string, number>; all: Map<string, number> } {
  const at = totals.sets.indexOf(set)
  const shown = new Map<string, number>()
  const every = new Map<string, number>()
  for (const row of totals.rows) {
    const group = String(row[at])
    if (group === '-' || !keep(row)) continue
    const km = Number(row.at(-1))
    every.set(group, (every.get(group) ?? 0) + km)
    if (picksMatch(totals, row, picks, set)) shown.set(group, (shown.get(group) ?? 0) + km)
  }
  return { shown, all: every }
}

/** Km the picks show. */
export function shownKm<S extends string>(totals: BandTotals, picks: Picks<S>, keep: Keep = () => true): number {
  return totals.rows.reduce(
    (sum, row) => (keep(row) && picksMatch(totals, row, picks) ? sum + Number(row.at(-1)) : sum),
    0,
  )
}

/** In the URL as `stress:3,4;speed:60,70`: the groups picked of each set, in the sets' order. */
export function formatPicks<S extends string>(groups: Record<S, readonly string[]>, picks: Picks<S>): string[] {
  return (Object.keys(groups) as S[])
    .filter((set) => picks[set]?.length)
    .map((set) => `${set}:${picks[set]?.join(',')}`)
}

/** The picks in the URL, leaving out sets and groups it does not know. */
export function parsePicks<S extends string>(groups: Record<S, readonly string[]>, text: string | undefined): Picks<S> {
  const picks: Picks<S> = {}
  for (const part of (text ?? '').split(';')) {
    const [set, values = ''] = part.split(':')
    if (!Object.hasOwn(groups, set)) continue
    const known = groups[set as S]
    const picked = values.split(',').filter((v) => known.includes(v))
    if (picked.length) picks[set as S] = picked
  }
  return picks
}

/**
 * The `by:` part of a layer's URL entry: the filter row the map is coloured
 * by, `none` when no row is open; left out when it is what the layer starts
 * with (a row, or none).
 */
export function formatBy<S extends string>(by: S | null | undefined, initial: S | null): string | null {
  // Filters kept from before rows coloured the map have no `by`: as they started.
  if (by === undefined || by === initial) return null
  return `by:${by ?? 'none'}`
}

export function parseBy<S extends string>(text: string | undefined, sets: readonly S[], initial: S | null): S | null {
  const by = (text ?? '')
    .split(';')
    .find((part) => part.startsWith('by:'))
    ?.slice('by:'.length)
  if (by === 'none') return null
  return sets.includes(by as S) ? (by as S) : initial
}
