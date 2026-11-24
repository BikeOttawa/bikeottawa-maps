import { describe, expect, it } from 'vitest'
import { closureSummary, closuresGeoJSON, middleOf } from './closures'
import { ROADWORK_ATTRIBUTION, ROADWORK_SOURCES, roadworkSourceNames } from './sources'
import { parse as parseOttawa } from './sources/ottawa'
import { parse as parseQuebec, url as quebecUrl } from './sources/quebec511'

describe('roadwork sources', () => {
  it("names the region's, for the overlay's hint", () => {
    expect(ROADWORK_SOURCES).toEqual(['ottawa', 'quebec511'])
    expect(roadworkSourceNames('en')).toBe('the City of Ottawa’s traffic map and Québec 511 on Quebec’s highways')
    expect(roadworkSourceNames('fr')).toBe(
      'carte de la circulation de la Ville d’Ottawa et Québec 511 sur les routes du Québec',
    )
    expect(ROADWORK_ATTRIBUTION.replace(/<[^>]+>/g, '')).toBe('Roadwork: City of Ottawa, Québec 511')
  })

  it("reads Ottawa's traffic map: coordinates as text, the span of its schedule, who reported it", () => {
    const json = {
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
        { id: 4, generation_source: 'HYDRO', geodata: { coordinates: [-75.7, 45.4] } },
      ],
    }
    const closures = parseOttawa(json, 'en')
    expect(closures).toEqual([
      {
        id: '1',
        at: [-75.750756, 45.387277],
        headline: 'Clare E/B between Churchill and Kirkwood',
        message: 'Clare eastbound closed.',
        street: 'Clare',
        lanes: 'closed',
        start: '2026-03-23T06:00',
        end: '2026-12-01T19:00',
        by: 'City of Ottawa',
      },
      // A reporter the site has no name for keeps the City's code.
      expect.objectContaining({ id: '4', by: 'HYDRO' }),
    ])
    expect(parseOttawa(json, 'fr')[0].by).toBe('Ville d’Ottawa')
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
    const [work, ...rest] = parseQuebec(json, 'en')
    expect(rest).toEqual([])
    expect(work).toMatchObject({
      id: '169869',
      headline: 'Structure repairs',
      message: 'On the Macdonald-Cartier Bridge\nDetour A-50',
      start: '2026-08-07T21:00',
      end: '2026-11-30T05:00',
      by: 'Québec 511 (Transports Québec)',
    })
    // The cone halfway along the stretch.
    expect(work.at[0]).toBeCloseTo(-75.71)
    expect(work.at[1]).toBeCloseTo(45.44)
    // French gives the detour apart, as well as in its text.
    expect(parseQuebec(json, 'fr')[0]).toMatchObject({ headline: 'Réfection de structures', detour: 'A-50' })
    expect(quebecUrl([-76, 45, -75, 46])).toContain('bbox=45,-76,46,-75,urn:ogc:def:crs:EPSG::4326')
  })
})

describe('closures', () => {
  it('puts the cone halfway along a stretch by distance, at any latitude', () => {
    const [lon, lat] = middleOf({
      type: 'MultiLineString',
      coordinates: [
        [
          [10, 60],
          [10, 60.01],
        ],
        [
          [10, 60.01],
          [10.06, 60.01],
        ],
      ],
    })
    // 0.01° north, then 0.06° east, which at 60° is 0.03° of distance: halfway is 0.02° along it, a third of the way east.
    expect(lon).toBeCloseTo(10.02, 3)
    expect(lat).toBeCloseTo(60.01)
  })

  it('draws a cone each, and the stretch where there is one', () => {
    const line = {
      type: 'LineString' as const,
      coordinates: [
        [0, 0],
        [1, 1],
      ],
    }
    const geo = closuresGeoJSON([
      { id: 'a-1', at: [0, 0], headline: '', message: '' },
      { id: 'b-2', at: [0.5, 0.5], line, headline: '', message: '' },
    ])
    expect(geo.features.map((f) => [f.geometry.type, f.properties?.id])).toEqual([
      ['LineString', 'b-2'],
      ['Point', 'a-1'],
      ['Point', 'b-2'],
    ])
  })
})

describe('closureSummary', () => {
  const clare = { id: 'ottawa-1', at: [0, 0] as [number, number], headline: 'Clare E/B', message: '' }
  it('says the street, what is closed there and until when', () => {
    expect(closureSummary({ ...clare, street: 'Clare', lanes: 'closed', end: '2026-12-01T19:00' }, 'en')).toBe(
      'Clare: closed\nuntil Dec 1',
    )
    expect(closureSummary({ ...clare, street: 'Clare', lanes: 'fermée', end: '2026-12-01T19:00' }, 'fr')).toMatch(
      /^Clare : fermée\njusqu’au 1 déc/,
    )
  })
  it('falls back on the headline, cut at a word when long', () => {
    const long = '(MTO) HWY 417 Westbound Off-ramp [ - RICHMOND RD (IC 130)/BAYSHORE DR ]'
    expect(closureSummary({ ...clare, headline: long }, 'en')).toBe('(MTO) HWY 417 Westbound Off-ramp [ - RICHMOND…')
  })
})
