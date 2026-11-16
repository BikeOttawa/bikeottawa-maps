import { describe, expect, it } from 'vitest'
import {
  type ComfortFilters,
  type ComfortTotals,
  comfortKm,
  comfortShownKm,
  DEFAULT_COMFORT_FILTERS,
  formatComfortFilters,
  parseComfortFilters,
} from './comfort'

const picks = (p: ComfortFilters['picks']): ComfortFilters => ({ ...DEFAULT_COMFORT_FILTERS, picks: p })

const totals: ComfortTotals = {
  sets: ['stress', 'type', 'speed', 'lanes', 'bikeway', 'surface'],
  rows: [
    ['4', 'primary', '60', '3', 'none', 'paved', 10],
    ['3', 'tertiary', '50', '1', 'lane', 'paved', 20],
    ['1', 'residential', '40', '1', 'none', 'paved', 30],
    ['1', 'path', '30', '-', 'path', 'unpaved', 40],
  ],
}

describe('comfort filters', () => {
  it('counts km of a set under the other sets’ picks, leaving out ways it does not apply to', () => {
    const speed = comfortKm(totals, picks({}), 'speed')
    expect(Object.fromEntries(speed.all)).toEqual({ '60': 10, '50': 20, '40': 30, '30': 40 })
    const lanes = comfortKm(totals, picks({}), 'lanes')
    expect(Object.fromEntries(lanes.all)).toEqual({ '3': 10, '1': 50 })
    const stress = comfortKm(totals, picks({ bikeway: ['none'] }), 'stress')
    expect(Object.fromEntries(stress.shown)).toEqual({ '4': 10, '1': 30 })
    expect(Object.fromEntries(stress.all)).toEqual({ '4': 10, '3': 20, '1': 70 })
  })

  it('adds up what the picks show; paths count as 30 km/h or less, and picking lanes leaves them out', () => {
    expect(comfortShownKm(totals, picks({}))).toBe(100)
    expect(comfortShownKm(totals, picks({ stress: ['1'] }))).toBe(70)
    expect(comfortShownKm(totals, picks({ stress: ['1'], speed: ['40'] }))).toBe(30)
    expect(comfortShownKm(totals, picks({ speed: ['30'] }))).toBe(40)
    expect(comfortShownKm(totals, picks({ stress: ['1'], lanes: ['1'] }))).toBe(30)
    expect(comfortShownKm(totals, picks({ type: ['primary', 'tertiary'] }))).toBe(30)
  })

  it('round-trips its picks through the URL', () => {
    const f = picks({ stress: ['3', '4'], speed: ['60', '70'] })
    expect(formatComfortFilters(f)).toBe('stress:3,4;speed:60,70')
    expect(parseComfortFilters('stress:3,4;speed:60,70')).toEqual(f)
    expect(formatComfortFilters(DEFAULT_COMFORT_FILTERS)).toBeNull()
    expect(parseComfortFilters('stress:9;moon:1')).toEqual(DEFAULT_COMFORT_FILTERS)
    // The row the map is coloured by, unless it is stress; none open is `none`.
    expect(formatComfortFilters({ ...f, by: 'speed' })).toBe('stress:3,4;speed:60,70;by:speed')
    expect(parseComfortFilters('by:speed').by).toBe('speed')
    expect(parseComfortFilters('by:none').by).toBeNull()
  })
})
