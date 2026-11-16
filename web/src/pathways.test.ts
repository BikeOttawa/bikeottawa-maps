import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PATHWAY_FILTERS,
  formatPathwayFilters,
  type PathwayTotals,
  parsePathwayFilters,
  pathwayFilter,
  pathwayKm,
  pathwayShownKm,
  widthBand,
} from './pathways'

const totals: PathwayTotals = {
  sets: ['type', 'surface', 'width', 'snow', 'smoothness', 'length'],
  rows: [
    ['path', 'asphalt', '2.5', 'yes', 'good', '10000', 10],
    ['path', 'ground', 'unknown', 'no', 'unknown', '1000', 20],
    ['cycleway', 'asphalt', '1.5', 'unknown', 'excellent', '500', 5],
    ['footway', 'concrete', '0', 'unknown', 'unknown', '100', 1],
  ],
}

describe('pathway filters', () => {
  it('leaves the defaults out of the URL', () => {
    expect(formatPathwayFilters(DEFAULT_PATHWAY_FILTERS)).toBeNull()
    expect(parsePathwayFilters(undefined)).toEqual(DEFAULT_PATHWAY_FILTERS)
  })

  it('round-trips through the URL', () => {
    const f = { picks: { surface: ['ground', 'gravel'], width: ['2.5'] }, minLength: 1000 }
    const text = formatPathwayFilters(f)
    expect(text).toBe('surface:ground,gravel;width:2.5;length:1000')
    expect(parsePathwayFilters(text ?? '')).toEqual(f)
    expect(formatPathwayFilters({ ...DEFAULT_PATHWAY_FILTERS, minLength: 0 })).toBe('length:0')
    expect(parsePathwayFilters('length:0').minLength).toBe(0)
  })

  it('ignores what it does not know', () => {
    expect(parsePathwayFilters('surface:paved,asphalt;colour:width').picks).toEqual({ surface: ['asphalt'] })
    expect(parsePathwayFilters('length:450').minLength).toBe(500)
    expect(parsePathwayFilters('length:far').minLength).toBe(DEFAULT_PATHWAY_FILTERS.minLength)
    expect(parsePathwayFilters('width;paved;2.5;1000').minLength).toBe(DEFAULT_PATHWAY_FILTERS.minLength)
  })

  it('filters the map by the picks, untagged as unknown, and by island length', () => {
    const filter = JSON.stringify(pathwayFilter({ picks: { snow: ['unknown'] }, minLength: 500 }))
    expect(filter).toContain('["in",["coalesce",["get","winter"],"unknown"],["literal",["unknown"]]]')
    expect(filter).toContain('["get","island_m"]')
    expect(filter).toContain(',500]')
  })

  it('counts km under the other picks, as long as the slider asks', () => {
    const f = { picks: { surface: ['asphalt'] }, minLength: 300 }
    expect(Object.fromEntries(pathwayKm(totals, f, 'type').shown)).toEqual({ path: 10, cycleway: 5 })
    expect(Object.fromEntries(pathwayKm(totals, f, 'surface').shown)).toEqual({ asphalt: 15, ground: 20 })
    expect(pathwayShownKm(totals, f)).toBe(15)
    expect(pathwayShownKm(totals, { picks: {}, minLength: 0 })).toBe(36)
    expect(pathwayShownKm(totals, { picks: {}, minLength: 1000 })).toBe(30)
  })

  it('bands widths as the pipeline does', () => {
    expect([1, 1.5, 3, 4].map(widthBand)).toEqual(['0', '1.5', '2.5', '3.5'])
  })
})
