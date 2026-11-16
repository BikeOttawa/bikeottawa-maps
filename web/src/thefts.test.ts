import { describe, expect, it } from 'vitest'
import {
  DEFAULT_THEFT_FILTERS,
  formatTheftFilters,
  matchesTheft,
  parseTheftFilters,
  type Theft,
  type TheftProps,
  theftGroupCounts,
  theftGroupOf,
  theftPlace,
  theftSpots,
  theftsByMonth,
} from './thefts'

const theft = (props: Partial<TheftProps>): TheftProps => ({
  id: 1,
  date: '2020-06-15',
  where: 'outdoors',
  type: 'hybrid',
  time: 'evening',
  ...props,
})

describe('thefts', () => {
  it('sorts thefts into groups, values by their band', () => {
    expect(theftGroupOf(theft({ value: 499 }), 'value')).toBe('0')
    expect(theftGroupOf(theft({ value: 500 }), 'value')).toBe('500')
    expect(theftGroupOf(theft({ value: 2500 }), 'value')).toBe('2500')
    expect(theftGroupOf(theft({}), 'value')).toBe('unknown')
    expect(theftGroupOf(theft({ where: 'home' }), 'where')).toBe('home')
    expect(theftGroupOf(theft({ type: 'unicycle' }), 'type')).toBe('other')
  })

  it('filters by years and groups', () => {
    const f = { ...DEFAULT_THEFT_FILTERS, from: 2021, to: 2022, groups: { where: ['home'] } }
    expect(matchesTheft(theft({ date: '2021-03-01', where: 'home' }), f)).toBe(true)
    expect(matchesTheft(theft({ date: '2021-03-01', where: 'outdoors' }), f)).toBe(false)
    expect(matchesTheft(theft({ date: '2020-03-01', where: 'home' }), f)).toBe(false)
  })

  it('counts a set without its own pick, and month by month across every year', () => {
    const all = [
      theft({ where: 'home' }),
      theft({ where: 'outdoors' }),
      theft({ where: 'outdoors', date: '2019-01-02' }),
    ]
    const f = { ...DEFAULT_THEFT_FILTERS, from: 2020, to: 2020, groups: { where: ['home'] } }
    const counts = theftGroupCounts(all, f, 'where')
    expect(counts.shown.get('outdoors')).toBe(1)
    expect(counts.shown.get('home')).toBe(1)
    const months = theftsByMonth(all, f)
    expect(months.get('2020-06')).toBe(1)
    expect(months.get('2019-01')).toBeUndefined()
  })

  it('round-trips its filters through the URL', () => {
    const f = { from: 2019, to: 2024, minCount: 5, groups: { where: ['outdoors'], value: ['1000', '2500'] } }
    const text = formatTheftFilters(f)
    expect(text).toBe('2019-2024;5;where:outdoors.value:1000,2500')
    expect(parseTheftFilters(text ?? '')).toEqual(f)
    expect(formatTheftFilters(DEFAULT_THEFT_FILTERS)).toBeNull()
    expect(parseTheftFilters('1990-2050;0;where:moon')).toEqual(DEFAULT_THEFT_FILTERS)
  })

  it('gathers thefts at their intersection, the most recent first', () => {
    const at: [number, number] = [-75.7, 45.4]
    const all: Theft[] = [
      { props: theft({ id: 1, date: '2019-05-01' }), at },
      { props: theft({ id: 2, date: '2023-05-01' }), at },
      { props: theft({ id: 3 }), at: [-75.6, 45.4] },
    ]
    const spots = theftSpots(all, DEFAULT_THEFT_FILTERS)
    expect(spots.map((s) => s.items.map((p) => p.id))).toEqual([[2, 1], [3]])
  })

  it('writes the police place names plainly', () => {
    expect(theftPlace('MACLAREN ST, METCALFE ST')).toBe('Maclaren St & Metcalfe St')
    expect(theftPlace('YORK ST, 72M EAST OF SUSSEX DR')).toBe('York St, 72 m East of Sussex Dr')
  })
})
