import { describe, expect, it } from 'vitest'
import {
  constructionCounts,
  constructionShown,
  DEFAULT_CONSTRUCTION_FILTERS,
  formatConstructionFilters,
  parseConstructionFilters,
} from './construction'

describe('construction', () => {
  it('picks nothing by default, which shows everything, coloured by when', () => {
    expect(DEFAULT_CONSTRUCTION_FILTERS).toEqual({ timings: [], kinds: [], by: 'timing' })
  })

  it("counts each set under the other's picks", () => {
    const all = [
      { id: 'a', kind: 'cycling', timing: 'now' },
      { id: 'b', kind: 'roads', timing: 'now' },
      { id: 'c', kind: 'roads', timing: 'later' },
    ] as const
    const f = { ...DEFAULT_CONSTRUCTION_FILTERS, timings: ['now'] as const }
    expect(Object.fromEntries(constructionCounts(all, f, 'kind').shown)).toEqual({ cycling: 1, roads: 1 })
    expect(Object.fromEntries(constructionCounts(all, f, 'timing').shown)).toEqual({ now: 2, later: 1 })
    expect(constructionShown(all, f)).toBe(2)
  })

  it('round-trips its filters through the URL', () => {
    const f = { timings: ['now', 'thisYear'] as const, kinds: ['cycling'] as const, by: 'kind' as const }
    const text = formatConstructionFilters(f)
    expect(text).toBe('now,thisYear;cycling;by:kind')
    expect(parseConstructionFilters(text ?? undefined)).toEqual({ ...f, timings: [...f.timings], kinds: [...f.kinds] })
    expect(formatConstructionFilters(DEFAULT_CONSTRUCTION_FILTERS)).toBeNull()
    expect(parseConstructionFilters('soonish;moon')).toEqual(DEFAULT_CONSTRUCTION_FILTERS)
    expect(parseConstructionFilters(undefined)).toEqual(DEFAULT_CONSTRUCTION_FILTERS)
    expect(formatConstructionFilters({ ...DEFAULT_CONSTRUCTION_FILTERS, by: 'kind' })).toBe(';;by:kind')
    expect(parseConstructionFilters(';;by:kind').by).toBe('kind')
  })
})
