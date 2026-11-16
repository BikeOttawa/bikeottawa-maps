import { describe, expect, it } from 'vitest'
import { type ComfortTotals, comfortKm, comfortShownKm, formatComfortFilters, parseComfortFilters } from './comfort'

const totals: ComfortTotals = {
  sets: ['stress', 'speed', 'lanes', 'bikeway', 'surface'],
  rows: [
    ['4', '60', 'many', 'none', 'paved', 10],
    ['3', '50', 'few', 'lane', 'paved', 20],
    ['1', '40', 'few', 'none', 'paved', 30],
    ['1', '-', '-', 'path', 'unpaved', 40],
  ],
}

describe('comfort filters', () => {
  it('counts km of a set under the other sets’ picks, leaving out ways it does not apply to', () => {
    const speed = comfortKm(totals, {}, 'speed')
    expect(Object.fromEntries(speed.all)).toEqual({ '60': 10, '50': 20, '40': 30 })
    const stress = comfortKm(totals, { bikeway: ['none'] }, 'stress')
    expect(Object.fromEntries(stress.shown)).toEqual({ '4': 10, '1': 30 })
    expect(Object.fromEntries(stress.all)).toEqual({ '4': 10, '3': 20, '1': 70 })
  })

  it('adds up what the picks show; picking a speed leaves paths out', () => {
    expect(comfortShownKm(totals, {})).toBe(100)
    expect(comfortShownKm(totals, { stress: ['1'] })).toBe(70)
    expect(comfortShownKm(totals, { stress: ['1'], speed: ['40'] })).toBe(30)
  })

  it('round-trips its picks through the URL', () => {
    const f = { stress: ['3', '4'], speed: ['60', '70'] }
    expect(formatComfortFilters(f)).toBe('stress:3,4.speed:60,70')
    expect(parseComfortFilters('stress:3,4.speed:60,70')).toEqual(f)
    expect(formatComfortFilters({})).toBeNull()
    expect(parseComfortFilters('stress:9.moon:1')).toEqual({})
  })
})
