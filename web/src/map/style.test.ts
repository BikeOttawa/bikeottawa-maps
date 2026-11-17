import type { FeatureCollection } from 'geojson'
import { describe, expect, it } from 'vitest'
import { BASEMAP_IDS, LAYER_IDS, LTS_COLORS } from '../layers'
import { DEFAULT_PATHWAY_FILTERS } from '../pathways'
import { PLACE_KINDS } from '../places'
import { partLook } from '../route/breakdown'
import { buildStyle, INTERACTIVE_LAYERS, type StyleState } from './style'

const state: StyleState = {
  lang: 'en',
  basemap: 'light',
  layer: 'comfort',
  placeKinds: PLACE_KINDS,
  selected: null,
  route: null,
  routeHighlight: null,
  reach: null,
  collisions: null,
}
const build = (patch: Partial<StyleState> = {}) => buildStyle({ ...state, ...patch }, 'https://example.test')
const layer = (style: ReturnType<typeof build>, id: string) => {
  const found = style.layers.find((l) => l.id === id)
  if (!found) throw new Error(`no layer ${id}`)
  return found as { layout?: { visibility?: string }; filter?: unknown }
}

describe('buildStyle', () => {
  it('draws collision spots only while their layer is on, sized against the busiest', () => {
    expect(build().sources.collisions).toBeUndefined()
    const spots: FeatureCollection = { type: 'FeatureCollection', features: [] }
    const style = build({ layer: 'collisions', collisions: spots })
    expect(style.sources.collisions).toMatchObject({ data: spots })
    expect(JSON.stringify((layer(style, 'collisions-point') as { paint?: unknown }).paint)).toContain('scale')
    // The heat map has each spot alone; the spots merge where they would overlap.
    expect(style.sources['collision-spots']).toMatchObject({ data: spots, cluster: true })
  })

  it('shows the split of big spots as pies, under the small ones, while a row colours them', () => {
    const spots = (patch: Partial<StyleState>, prefix: string) =>
      build(patch)
        .layers.map((l) => l.id)
        .filter((id) => id.startsWith(prefix) && id !== `${prefix}heat`)
    // With no row open, worst injury and the value stolen are one colour a spot.
    expect(spots({ layer: 'collisions' }, 'collisions-')).toEqual(['collisions-point'])
    expect(spots({ layer: 'collisions', collisionsBy: 'severity' }, 'collisions-')).toEqual([
      'collisions-pie',
      'collisions-point',
    ])
    expect(spots({ layer: 'thefts' }, 'thefts-')).toEqual(['thefts-point'])
    expect(spots({ layer: 'thefts', theftsBy: 'where' }, 'thefts-')).toEqual(['thefts-pie', 'thefts-point'])
    const style = build({ layer: 'collisions', collisionsBy: 'weather' })
    expect(spots({ layer: 'collisions', collisionsBy: 'weather' }, 'collisions-')).toEqual([
      'collisions-pie',
      'collisions-point',
    ])
    // Each spot is one or the other.
    const pie = layer(style, 'collisions-pie') as { filter: unknown; layout: Record<string, unknown> }
    expect(layer(style, 'collisions-point').filter).toEqual(['!', pie.filter])
    expect(JSON.stringify(pie.layout['icon-image'])).toContain('pie:')
  })

  it('gives the reach map the street lines to itself', () => {
    const style = build({ layer: 'comfort', reach: { minutes: 15, area: false } })
    expect(style.sources.reach).toBeDefined()
    expect(layer(style, 'reach-line')).toBeDefined()
    expect(style.layers.some((l) => l.id === 'comfort-line')).toBe(false)
    expect(style.sources.overlays).toBeUndefined()
    expect(build().sources.reach).toBeUndefined()
  })

  it('draws the reach as an area instead of lines when asked', () => {
    const style = build({ reach: { minutes: 15, area: true } })
    expect(layer(style, 'reach-area')).toBeDefined()
    expect(layer(style, 'reach-edge')).toBeDefined()
    expect(style.layers.some((l) => l.id === 'reach-line')).toBe(false)
  })

  it('draws, and so downloads, only the active data layer', () => {
    for (const active of LAYER_IDS) {
      // A row open, so spots have their pies too.
      const style = build({ layer: active, collisionsBy: 'weather', theftsBy: 'where' })
      for (const id of LAYER_IDS) {
        for (const mapLayer of INTERACTIVE_LAYERS[id]) {
          const found = style.layers.find((l) => l.id === mapLayer) as { layout?: { visibility?: string } } | undefined
          // The active layer is drawn; others are left out, or hidden when they share its tiles.
          if (id === active) {
            expect(found, `${mapLayer} when ${active}`).toBeDefined()
            expect(found?.layout?.visibility ?? 'visible', `${mapLayer} when ${active}`).toBe('visible')
          } else if (found) expect(found.layout?.visibility, `${mapLayer} when ${active}`).toBe('none')
        }
      }
    }
  })

  it('loads street tiles only for comfort and pathways, place tiles only for places', () => {
    const sources = (layerId: (typeof LAYER_IDS)[number]) => Object.keys(build({ layer: layerId }).sources)
    expect(sources('comfort')).toContain('overlays')
    expect(sources('pathways')).toContain('overlays')
    expect(sources('comfort')).not.toContain('places')
    expect(sources('places')).toContain('places')
    // With no kind ticked there is nothing to draw, so nothing to load.
    expect(Object.keys(build({ layer: 'places', placeKinds: [] }).sources)).not.toContain('places')
    for (const other of ['places', 'collisions'] as const) expect(sources(other)).not.toContain('overlays')
  })

  it('colours pathways by the open row, surface at first, unknown ones on top, and filters them by the picks', () => {
    const pathways = { ...DEFAULT_PATHWAY_FILTERS, picks: { width: ['2.5', '3.5'] } }
    const line = layer(build({ layer: 'pathways', pathways }), 'pathways-line') as {
      paint: { 'line-color': unknown }
      layout: { 'line-sort-key': unknown }
      filter: unknown
    }
    expect(JSON.stringify(line.paint['line-color'])).toContain('surface_group')
    expect(JSON.stringify(line.layout['line-sort-key'])).toContain('surface_group')
    expect(JSON.stringify(line.filter)).toContain('["literal",["2.5","3.5"]]')
    // The open row colours the map: snow clearing, untagged as unknown, on top.
    const bySnow = layer(build({ layer: 'pathways', pathways: { ...pathways, by: 'snow' } }), 'pathways-line') as {
      paint: { 'line-color': unknown }
      layout: { 'line-sort-key': unknown }
    }
    expect(JSON.stringify(bySnow.paint['line-color'])).toContain('["coalesce",["get","winter"],"unknown"]')
    expect(JSON.stringify(bySnow.layout['line-sort-key'])).toContain('winter')
  })

  it('loads the wards only when turned on, labelled in the language picked', () => {
    expect(build().sources.wards).toBeUndefined()
    expect(build().layers.some((l) => l.id.startsWith('wards'))).toBe(false)
    const on = build({ wards: true, lang: 'fr' })
    expect((on.sources.wards as { data: string }).data).toContain('/data/wards.geojson')
    const label = layer(on, 'wards-label') as { layout: Record<string, unknown> }
    expect(JSON.stringify(label.layout['text-field'])).toContain('name_fr')
    const ids = on.layers.map((l) => l.id)
    expect(ids.indexOf('wards-line')).toBeLessThan(ids.indexOf('route-line'))
  })

  it('draws the bike lanes overlay under the pathways', () => {
    const ids = build({ layer: 'pathways', bikeLanes: true }).layers.map((l) => l.id)
    expect(ids.findLastIndex((id) => id.startsWith('bike-lanes'))).toBeLessThan(ids.indexOf('pathways-casing'))
  })

  it('loads place tiles for a selected place, to pick out one found by a search', () => {
    const selected = {
      kind: 'place' as const,
      osm: 'node/60890260',
      props: {},
      at: [-75.69, 45.42] as [number, number],
    }
    const style = build({ layer: 'comfort', selected })
    expect(Object.keys(style.sources)).toContain('places')
    expect(layer(style, 'selected-place').filter).toEqual(['==', ['get', 'osm'], 'node/60890260'])
    expect(style.layers.find((l) => l.id === 'places-icon')).toBeUndefined()
  })

  it('draws lines below the basemap labels and place markers above them', () => {
    const { layers } = build()
    const firstLabel = layers.findIndex((l) => l.type === 'symbol' && l.source === 'basemap')
    const lines = layers.flatMap((l, i) => (l.type === 'line' && l.source !== 'basemap' ? [i] : []))
    expect(firstLabel).toBeGreaterThan(-1)
    expect(Math.max(...lines)).toBeLessThan(firstLabel)
    const places = build({ layer: 'places' }).layers
    const lastLabel = places.findLastIndex((l) => l.type === 'symbol' && l.source === 'basemap')
    expect(places.findIndex((l) => l.id === 'places-icon')).toBeGreaterThan(lastLabel)
  })

  it('names places from zoom 15, in a colour that suits the basemap', () => {
    const places = (basemap: 'light' | 'dark') =>
      build({ basemap, layer: 'places' }).layers.find((l) => l.id === 'places-icon') as {
        layout: Record<string, unknown>
        paint: Record<string, unknown>
      }
    expect(places('light').layout['text-field']).toEqual(['step', ['zoom'], '', 15, ['coalesce', ['get', 'name'], '']])
    expect(places('light').layout['text-optional']).toBe(true)
    expect(places('light').paint['text-color']).not.toBe(places('dark').paint['text-color'])
    expect(places('dark').paint['text-color']).toBe('#FFFFFF')
  })

  it('filters the selection and the place kinds', () => {
    const streets = build({ layer: 'comfort', selected: { kind: 'way', id: 42, props: {}, at: [-75.7, 45.4] } })
    expect(layer(streets, 'selected-way').filter).toEqual(['==', ['id'], 42])
    const places = build({ layer: 'places', placeKinds: ['water'] })
    expect(layer(places, 'selected-place').filter).toEqual(['==', ['get', 'osm'], ''])
    expect(layer(places, 'places-icon').filter).toEqual(['in', ['get', 'kind'], ['literal', ['water']]])
  })

  it('draws the planned route as one line per segment with its stress level', () => {
    const route = {
      coords: [],
      distance: 10,
      time: 5,
      ascent: 0,
      segments: [
        {
          coords: [
            [-75.7, 45.4],
            [-75.69, 45.41],
          ] as [number, number][],
          distance: 10,
          lts: 3,
          walk: null,
          tags: { highway: 'residential', cycleway: 'lane' },
          reversed: false,
        },
      ],
      stops: [{ kind: 'light' as const, lngLat: [-75.69, 45.41] as [number, number] }],
    }
    const source = build({ route }).sources.route as { data: FeatureCollection }
    expect(source.data.features).toHaveLength(1)
    expect(source.data.features[0].properties).toEqual({ part: 'lts3', color: LTS_COLORS[2] })
    // Coloured by what the route card shows.
    const byBikeway = build({ route, routeView: 'bikeway' }).sources.route as { data: FeatureCollection }
    expect(byBikeway.data.features[0].properties).toEqual({ part: 'lane', color: partLook('bikeway', 'lane').color })
    expect((build().sources.route as { data: FeatureCollection }).data.features).toHaveLength(0)
    const stops = build({ route }).sources['route-stops'] as { data: FeatureCollection }
    expect(stops.data.features.map((f) => f.properties)).toEqual([{ kind: 'light' }])
  })

  it('picks out one part of the route and fades the rest', () => {
    const plain = build()
    expect(layer(plain, 'route-highlight').filter).toEqual(['==', ['get', 'part'], ''])
    const picked = build({ routeHighlight: 'sidewalk' })
    expect(layer(picked, 'route-highlight').filter).toEqual(['==', ['get', 'part'], 'sidewalk'])
    const line = picked.layers.find((l) => l.id === 'route-line') as { paint: Record<string, unknown> }
    expect(line.paint['line-opacity']).toEqual(['case', ['==', ['get', 'part'], 'sidewalk'], 1, 0.3])
  })

  it('picks out stop signs or traffic lights and fades the route', () => {
    const picked = build({ routeHighlight: 'light' })
    expect(layer(picked, 'route-stops-highlight').filter).toEqual(['==', ['get', 'kind'], 'light'])
    const icons = picked.layers.find((l) => l.id === 'route-stops') as {
      paint: Record<string, unknown>
      minzoom: number
    }
    expect(icons.paint['icon-opacity']).toEqual(['case', ['==', ['get', 'kind'], 'light'], 1, 0.3])
    expect(icons.minzoom).toBe(0)
    expect((build().layers.find((l) => l.id === 'route-stops') as { minzoom: number }).minzoom).toBe(12)
    // No stretch of the route is a "light", so all of it fades.
    expect(layer(picked, 'route-highlight').filter).toEqual(['==', ['get', 'part'], 'light'])
  })

  it('colours the comfort layer by its open row, stress at first', () => {
    const color = (comfort?: { picks: Record<string, string[]>; by: 'stress' | 'lanes' | null }) =>
      JSON.stringify(
        (layer(build({ layer: 'comfort', comfort }), 'comfort-line') as { paint: Record<string, unknown> }).paint[
          'line-color'
        ],
      )
    expect(color()).toContain('"lts"')
    // Paths have no lanes: drawn as not applying, apart from lanes not tagged.
    expect(color({ picks: {}, by: 'lanes' })).toContain('["to-string",["coalesce",["get","lane_band"],"-"]]')
    expect(color({ picks: {}, by: null })).toContain('"lts"')
  })

  it('lights the street lamps with the street lights overlay, the glow under the data lines', () => {
    const night = build({ layer: 'comfort', lights: true, basemap: 'dark' })
    expect(night.sources.night).toMatchObject({ type: 'vector' })
    expect(night.layers.find((l) => l.id === 'night-glow')).toMatchObject({ type: 'heatmap', 'source-layer': 'lamps' })
    expect(night.layers.find((l) => l.id === 'night-streets')).toMatchObject({
      type: 'line',
      source: 'night',
      'source-layer': 'streets',
    })
    expect(night.layers.find((l) => l.id === 'night-lamps')).toMatchObject({ type: 'circle', minzoom: 14 })
    const at = (id: string) => night.layers.findIndex((l) => l.id === id)
    expect(at('night-streets')).toBeLessThan(at('comfort-line'))
    expect(at('night-lamps')).toBeGreaterThan(at('comfort-line'))
    // Off, the lamps are neither loaded nor drawn.
    const day = build({ layer: 'comfort' })
    expect(day.sources.night).toBeUndefined()
    expect(day.layers.some((l) => l.id.startsWith('night-'))).toBe(false)
  })

  it('draws the street lights on whichever basemap is chosen', () => {
    const colorOf = (basemap: 'light' | 'dark' | 'satellite') => {
      const style = build({ layer: 'places', lights: true, basemap })
      const streets = style.layers.find((l) => l.id === 'night-streets')
      return { style, color: streets?.type === 'line' ? streets.paint?.['line-color'] : undefined }
    }
    const dark = colorOf('dark')
    const light = colorOf('light')
    expect(light.style.sprite).toMatch(/light$/)
    // Pale ground gets a deeper light than dark ground.
    expect(light.color).not.toBe(dark.color)
    // Dark is darker still at night than by day.
    expect(dark.style.layers[0]).not.toEqual(build({ layer: 'comfort', basemap: 'dark' }).layers[0])
    expect(colorOf('satellite').style.sources.imagery).toBeDefined()
  })

  it('restyles the same tiles for each drawn basemap', () => {
    for (const basemap of ['light', 'grey', 'dark'] as const) {
      const style = build({ basemap })
      expect(style.sources.imagery, basemap).toBeUndefined()
      expect(
        style.layers.some((l) => l.type === 'fill'),
        basemap,
      ).toBe(true)
    }
    expect(build({ basemap: 'dark' }).sprite).toMatch(/dark$/)
    expect(build({ basemap: 'grey' }).sprite).toMatch(/grayscale$/)
  })

  it('puts imagery under the data and keeps only labels from the basemap for satellite', () => {
    const { layers, sources } = build({ basemap: 'satellite' })
    expect(sources.imagery).toMatchObject({ type: 'raster' })
    expect(layers[0]).toMatchObject({ id: 'imagery', type: 'raster' })
    expect(layers.filter((l) => 'source' in l && l.source === 'basemap').every((l) => l.type === 'symbol')).toBe(true)
    const firstData = layers.findIndex((l) => 'source' in l && l.source === 'overlays')
    expect(firstData).toBe(1)
  })

  it('keeps layer ids unique', () => {
    for (const basemap of BASEMAP_IDS) {
      const ids = build({ basemap }).layers.map((l) => l.id)
      expect(new Set(ids).size, basemap).toBe(ids.length)
    }
  })
})
