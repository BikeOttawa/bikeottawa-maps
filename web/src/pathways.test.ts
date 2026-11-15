import { describe, expect, it } from 'vitest'
import { DEFAULT_PATHWAY_FILTERS, formatPathwayFilters, parsePathwayFilters, pathwayFilter } from './pathways'

describe('pathway filters', () => {
  it('leaves the defaults out of the URL', () => {
    expect(formatPathwayFilters(DEFAULT_PATHWAY_FILTERS)).toBeNull()
    expect(parsePathwayFilters(undefined)).toEqual(DEFAULT_PATHWAY_FILTERS)
  })

  it('round-trips through the URL', () => {
    const filters = {
      show: false,
      by: 'width' as const,
      surfaces: ['paved', 'unknown'] as const,
      minWidth: 2.5,
      unknownWidth: false,
      minLength: 1000,
    }
    const text = formatPathwayFilters(filters)
    expect(text).toBe('width;paved,unknown;2.5;1000;known;off')
    expect(parsePathwayFilters(text ?? '')).toEqual(filters)
    expect(parsePathwayFilters('width')).toEqual({ ...DEFAULT_PATHWAY_FILTERS, by: 'width' })
    expect(parsePathwayFilters(';none').surfaces).toEqual([])
    expect(formatPathwayFilters({ ...DEFAULT_PATHWAY_FILTERS, minLength: 0 })).toBe(';;;0')
    expect(parsePathwayFilters(';;;0').minLength).toBe(0)
  })

  it('ignores what it does not know', () => {
    expect(parsePathwayFilters('colour;asphalt,paved;9')).toEqual({ ...DEFAULT_PATHWAY_FILTERS, surfaces: ['paved'] })
    expect(parsePathwayFilters(';;1.3').minWidth).toBe(1.5)
    expect(parsePathwayFilters(';;;450').minLength).toBe(500)
    expect(parsePathwayFilters(';;;far').minLength).toBe(DEFAULT_PATHWAY_FILTERS.minLength)
  })

  it('leaves out islands shorter than the least length', () => {
    const filter = JSON.stringify(pathwayFilter({ ...DEFAULT_PATHWAY_FILTERS, minLength: 500 }))
    expect(filter).toContain('["get","island_m"]')
    expect(filter).toContain(',500]')
  })

  it('keeps unknown widths unless asked not to', () => {
    const at = (unknownWidth: boolean) =>
      JSON.stringify(pathwayFilter({ ...DEFAULT_PATHWAY_FILTERS, minWidth: 3, unknownWidth }))
    expect(at(true)).toContain('["case",["has","width_m"],[">=",["get","width_m"],3],true]')
    expect(at(false)).toContain('["case",["has","width_m"],[">=",["get","width_m"],3],false]')
  })
})
