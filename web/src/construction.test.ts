import { describe, expect, it } from 'vitest'
import {
  closureSummary,
  constructionCounts,
  constructionShown,
  DEFAULT_CONSTRUCTION_FILTERS,
  formatConstructionFilters,
  parseClosures,
  parseConstructionFilters,
  parseQuebecRoadwork,
  quebecRoadworkUrl,
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

  it('reads the traffic map: coordinates as text, the span of its schedule', () => {
    const closures = parseClosures({
      events: [
        {
          id: 1,
          headline: ' Clare E/B between Churchill and Kirkwood ',
          message: 'Clare eastbound closed.',
          mainStreet: ' Clare ',
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
        id: 'ottawa-1',
        at: [-75.750756, 45.387277],
        headline: 'Clare E/B between Churchill and Kirkwood',
        message: 'Clare eastbound closed.',
        street: 'Clare',
        lanes: 'closed',
        start: '2026-03-23T06:00',
        end: '2026-12-01T19:00',
        source: 'CITY',
      },
    ])
  })

  it("reads Quebec's roadwork: the work as the title, the rest as text, a cone mid-stretch", () => {
    const json = {
      features: [
        {
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [-75.7, 45.43],
              [-75.71, 45.44],
              [-75.72, 45.45],
            ],
          },
          properties: {
            identifiant: '169869',
            descriptionFrancais: 'Réfection de structures\nSur le pont Macdonald-Cartier\nDétour A-50',
            descriptionAnglais: 'Structure repairs\nOn the Macdonald-Cartier Bridge\nDetour A-50',
            detoursEtItinerairesFacultatifs: ' A-50 ',
            debut: '2026/08/07 21:00:00',
            fin: '2026/11/30 05:00:00',
          },
        },
        { geometry: null, properties: { identifiant: '2' } },
      ],
    }
    const [work, ...rest] = parseQuebecRoadwork(json, 'en')
    expect(rest).toEqual([])
    expect(work).toMatchObject({
      id: 'quebec-169869',
      headline: 'Structure repairs',
      message: 'On the Macdonald-Cartier Bridge\nDetour A-50',
      start: '2026-08-07T21:00',
      end: '2026-11-30T05:00',
      source: 'QUEBEC',
    })
    // The cone halfway along the stretch.
    expect(work.at[0]).toBeCloseTo(-75.71)
    expect(work.at[1]).toBeCloseTo(45.44)
    // French gives the detour apart, as well as in its text.
    expect(parseQuebecRoadwork(json, 'fr')[0]).toMatchObject({ headline: 'Réfection de structures', detour: 'A-50' })
    expect(quebecRoadworkUrl([-76, 45, -75, 46])).toContain('bbox=45,-76,46,-75,urn:ogc:def:crs:EPSG::4326')
  })
})

describe('closureSummary', () => {
  const clare = { id: 'ottawa-1', at: [0, 0] as [number, number], headline: 'Clare E/B', message: '' }
  it('says the street, what is closed there and until when', () => {
    expect(closureSummary({ ...clare, street: 'Clare', lanes: 'closed', end: '2026-12-01T19:00' }, 'en')).toBe(
      'Clare: closed\nuntil Dec 1',
    )
    expect(closureSummary({ ...clare, street: 'Clare', lanes: 'fermée', end: '2026-12-01T19:00' }, 'fr')).toMatch(
      /^Clare\u00a0: fermée\njusqu’au 1 déc/,
    )
  })
  it('falls back on the headline, cut at a word when long', () => {
    const long = '(MTO) HWY 417 Westbound Off-ramp [ - RICHMOND RD (IC 130)/BAYSHORE DR ]'
    expect(closureSummary({ ...clare, headline: long }, 'en')).toBe('(MTO) HWY 417 Westbound Off-ramp [ - RICHMOND…')
  })
})
