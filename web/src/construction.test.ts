import { describe, expect, it } from 'vitest'
import {
  constructionCounts,
  constructionShown,
  DEFAULT_CONSTRUCTION_FILTERS,
  formatConstructionFilters,
  parseClosures,
  parseConstructionFilters,
} from './construction'

describe('construction', () => {
  it('picks nothing by default, which shows everything', () => {
    expect(DEFAULT_CONSTRUCTION_FILTERS).toEqual({ timings: [], kinds: [] })
  })

  it("counts each set under the other's picks", () => {
    const all = [
      { id: 'a', kind: 'cycling', timing: 'now' },
      { id: 'b', kind: 'roads', timing: 'now' },
      { id: 'c', kind: 'roads', timing: 'later' },
    ] as const
    const f = { timings: ['now'] as const, kinds: [] }
    expect(Object.fromEntries(constructionCounts(all, f, 'kind').shown)).toEqual({ cycling: 1, roads: 1 })
    expect(Object.fromEntries(constructionCounts(all, f, 'timing').shown)).toEqual({ now: 2, later: 1 })
    expect(constructionShown(all, f)).toBe(2)
  })

  it('round-trips its filters through the URL', () => {
    const f = { timings: ['now', 'thisYear'] as const, kinds: ['cycling'] as const }
    const text = formatConstructionFilters(f)
    expect(text).toBe('now,thisYear;cycling')
    expect(parseConstructionFilters(text ?? undefined)).toEqual({ ...f, timings: [...f.timings], kinds: [...f.kinds] })
    expect(formatConstructionFilters(DEFAULT_CONSTRUCTION_FILTERS)).toBeNull()
    expect(parseConstructionFilters('soonish;moon')).toEqual(DEFAULT_CONSTRUCTION_FILTERS)
    expect(parseConstructionFilters(undefined)).toEqual(DEFAULT_CONSTRUCTION_FILTERS)
  })

  it('reads the traffic map: coordinates as text, the span of its schedule', () => {
    const closures = parseClosures({
      events: [
        {
          id: 1,
          headline: ' Clare E/B between Churchill and Kirkwood ',
          message: 'Clare eastbound closed.',
          lanes: 'closed',
          generation_source: 'CITY',
          schedule: [
            { startDateTime: '2026-05-01T06:00', endDateTime: '2026-05-02T19:00' },
            { startDateTime: '2026-03-23T06:00', endDateTime: '2026-12-01T19:00' },
          ],
          geodata: { type: 'POINT', coordinates: '[-75.750756, 45.387277]' },
        },
        { id: 2, headline: 'Nowhere', geodata: { type: 'POINT' } },
        { id: 3, headline: 'Broken', geodata: { type: 'POINT', coordinates: '[oops' } },
      ],
    })
    expect(closures).toEqual([
      {
        id: 1,
        at: [-75.750756, 45.387277],
        headline: 'Clare E/B between Churchill and Kirkwood',
        message: 'Clare eastbound closed.',
        lanes: 'closed',
        start: '2026-03-23T06:00',
        end: '2026-12-01T19:00',
        source: 'CITY',
      },
    ])
  })
})
