import { layers as basemapLayers, type Flavor, namedFlavor } from '@protomaps/basemaps'
import type { FeatureCollection } from 'geojson'
import type { ExpressionSpecification, FilterSpecification, LayerSpecification, StyleSpecification } from 'maplibre-gl'
import {
  type CollisionSet,
  collisionGroups,
  conditionColor,
  partyColor,
  SEVERITIES,
  type Severity,
} from '../collisions'
import {
  type ComfortFilters,
  comfortColorBy,
  comfortFilter,
  comfortGroupOf,
  comfortPicked,
  DEFAULT_COMFORT_FILTERS,
} from '../comfort'
import {
  CONSTRUCTION_TIMINGS,
  type ConstructionFilters,
  constructionColorBy,
  constructionFilter,
  DEFAULT_CONSTRUCTION_FILTERS,
} from '../construction'
import type { Lang } from '../i18n'
import {
  type BasemapId,
  type BikewayId,
  bikewayColors,
  CONSTRUCTION_KIND_COLORS,
  collisionColors,
  comfortSetColors,
  constructionColors,
  INK,
  LAMP_COLOR,
  type LayerId,
  NOT_APPLICABLE,
  OTHER,
  pathwayColors,
  pathwaySetColors,
  ROUTE_COLORS,
  type RouteLevelId,
  reachRamp,
  routeBandColors,
  STREET_LIGHT_ON_PALE,
  theftColors,
  wardColors,
} from '../layers'
import {
  colorBy,
  DEFAULT_PATHWAY_FILTERS,
  type PathwayFilters,
  pathwayFilter,
  pathwayGroupOf,
  UNKNOWN_WIDTH,
} from '../pathways'
import type { PlacePoints } from '../placePoints'
import { GROUP_COLORS, PLACE_GROUP_IDS, type PlaceGroupId, type PlaceKind, placeGroup, placeImageId } from '../places'
import { partLook, partOf, type RouteView } from '../route/breakdown'
import { type Route, type RouteHighlight, STOP_KINDS, type StopKind } from '../route/brouter'
import { THEFT_GROUPS, type TheftGroupId, theftGroupColor, VALUE_STEPS } from '../thefts'
import { CLOSURE_IMAGE, CONSTRUCTION_ORANGE } from './closureImage'
import {
  isPie,
  MERGE_RADIUS,
  MERGED_UNTIL,
  mergedProperties,
  mostCommon,
  pieImage,
  pieSize,
  SPOTS_FROM,
  spotRadius,
} from './pieImage'
import { BUBBLE_IMAGE } from './stopImage'

/** What was clicked on the map; `at` is where its details are anchored. */
export type Selected =
  | { kind: 'way'; id: number; props: Record<string, unknown>; at: [number, number] }
  | {
      kind: 'place'
      osm: string
      props: Record<string, unknown>
      at: [number, number]
      /** Found by a search: the props are the search's until the map finds the place in its own data. */
      searched?: boolean
    }
  /** A spot on the collisions layer, by its key (see collisionSpots). */
  | { kind: 'collision'; spot: string; at: [number, number] }
  /** An intersection on the thefts layer, by its key (see theftSpots). */
  | { kind: 'theft'; spot: string; at: [number, number] }
  /** A project on the construction layer, with its properties. */
  | { kind: 'construction'; props: Record<string, unknown>; at: [number, number] }
  /** A closure on the construction layer or the route, by its id on the City's traffic map. */
  | { kind: 'closure'; id: string; at: [number, number] }
  /** A barrier on the route, by its OSM `barrier` value. */
  | { kind: 'barrier'; barrier: string; at: [number, number] }
  /**
   * A way on the bike routes overlay: the routes it is directly on (relation
   * ids, best first) and the one picked out on the map, which may be a route
   * those are part of.
   */
  | { kind: 'route'; routes: string[]; focus: string; at: [number, number] }

export interface StyleState {
  lang: Lang
  basemap: BasemapId
  layer: LayerId
  /** Place kinds shown on the places layer. */
  placeKinds: readonly PlaceKind[]
  /** The places of those kinds by group, merged by the map when zoomed out; null until loaded. */
  placePoints?: PlacePoints | null
  selected: Selected | null
  /** Planned route to draw, coloured by what the route card shows (`routeView`). */
  route: Route | null
  /** The trip's other routes, drawn grey to pick from, by their place among its routes. */
  routeOthers?: { route: Route; choice: number }[]
  /** Faint and without their bubbles, while the chosen route is looked at closely. */
  routeOthersDim?: boolean
  /** Legend item to pick out on the route, the rest of it stepping back. */
  routeHighlight: RouteHighlight | null
  /** Stop signs, traffic lights, barriers and roadwork on the route. Off, only the kind picked out shows. */
  routeStops?: boolean
  /** What the route line is coloured by; comfort when not given. */
  routeView?: RouteView
  /** A walking route is one colour; cycling comfort means nothing on foot. */
  routeOnFoot?: boolean
  /**
   * Showing how far you get in this many minutes. The lines themselves are too
   * many to diff with every style change, so the map view sets them on the
   * source directly. `area`: drawn as the area they cover, not the lines.
   */
  reach: { minutes: number; area: boolean } | null
  /** The collisions layer's spots, built from the filters; null until loaded. */
  collisions: FeatureCollection | null
  /** The legend's open row the spots are coloured by (their `group`); worst injury when left out. */
  collisionsBy?: CollisionSet | null
  /** The thefts layer's spots, built from the filters; null until loaded. */
  thefts?: FeatureCollection | null
  /** The legend's open row the spots are coloured by (their `group`); by value stolen when none. */
  theftsBy?: TheftGroupId | null
  /** What the construction layer shows. */
  construction?: ConstructionFilters
  /** The roadwork overlay: the closures on the City's traffic map right now, as cones. */
  roadwork?: boolean
  /** Those closures; null until loaded. */
  closures?: FeatureCollection | null
  /** Which ways the comfort layer shows. */
  comfort?: ComfortFilters
  /** Which pathways the pathways layer shows. */
  pathways?: PathwayFilters
  /** The bike lanes overlay, drawn over any basemap and data layer but the pathways one. */
  bikeLanes?: boolean
  /** The bike routes overlay: signed routes and mountain-bike trails. */
  bikeRoutes?: boolean
  /** Ottawa's wards and Gatineau's districts, with their councillors. */
  wards?: boolean
  /** The street lights overlay: lit streets and paths, and the lamps. */
  lights?: boolean
  /** Places of one kind picked out on the map: those within reach on How far. */
  placeHighlight?: { kind: PlaceKind; points: readonly [number, number][] } | null
}

/** Layers of the bike routes overlay a click can hit, under those of the data layer. */
export const ROUTE_LAYERS = ['routes-band']

/** Layers of the roadwork overlay a click can hit, over those of the data layer. */
export const ROADWORK_LAYERS = ['closures-icon', 'closures-line']

/** Layers a click can hit, per data layer. */
export const INTERACTIVE_LAYERS: Record<LayerId, string[]> = {
  comfort: ['comfort-line'],
  pathways: ['pathways-line'],
  places: [
    'places-icon',
    ...PLACE_GROUP_IDS.flatMap((group) => [mergedPlacesId(group), `${mergedPlacesId(group)}-alone`]),
  ],
  collisions: ['collisions-point', 'collisions-pie'],
  thefts: ['thefts-point', 'thefts-pie'],
  construction: ['construction-point', 'construction-line'],
}

const ATTRIBUTION =
  '<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap</a> · <a href="https://protomaps.com" target="_blank" rel="noopener">Protomaps</a>'

/** Without the basemap's own place icons and land-cover tint, which compete with the data. */
const plain = (flavor: Flavor): Flavor => ({ ...flavor, pois: undefined, landcover: undefined })

interface Theme {
  flavor: Flavor
  /** Sprite sheet for road shields, matching the flavor. */
  sprite: string
  /** Outline that separates data lines from the ground. */
  casing: string
  /** Strong outline for the selection and the planned route; also the colour of our own labels. */
  contrast: string
  /** Outline that keeps our labels readable over the ground. */
  halo: string
  /** Aerial imagery under the labels instead of the drawn map. */
  imagery?: boolean
  /** Colours of the street lights on this ground. */
  lights: Lights
}

interface Lights {
  /** Core of a lit street, and the lamp dots. */
  lamp: string
  /** Soft line around a lit street. */
  glow: string
  /** Blur around the lamps, from its faint edge to its brightest middle. */
  heat: [string, string, string, string, string]
}

/** Soft warm white, like LED street lights, for dark ground. */
const LIGHTS_ON_DARK: Lights = {
  lamp: LAMP_COLOR,
  glow: '#F2D3A0',
  heat: [
    'rgba(250, 210, 155, 0)',
    'rgba(250, 212, 160, 0.25)',
    'rgba(252, 226, 190, 0.7)',
    'rgba(255, 239, 215, 0.92)',
    'rgba(255, 250, 240, 1)',
  ],
}

/** On pale ground a soft yellow, light enough to sit under the data lines. */
const LIGHTS_ON_PALE: Lights = {
  lamp: STREET_LIGHT_ON_PALE,
  glow: '#FFD047',
  heat: [
    'rgba(255, 208, 71, 0)',
    'rgba(255, 208, 71, 0.18)',
    'rgba(255, 200, 50, 0.32)',
    'rgba(250, 188, 30, 0.45)',
    'rgba(240, 175, 10, 0.55)',
  ],
}

const THEMES: Record<BasemapId, Theme> = {
  // Protomaps' light basemap, muted so the data layers carry the colour.
  light: {
    flavor: plain({
      ...namedFlavor('light'),
      background: '#EEF0EA',
      earth: '#EEF0EA',
      water: '#BBD6E6',
      park_a: '#DFE9D6',
      park_b: '#D3E2C7',
      wood_a: '#DFE9D6',
      wood_b: '#CFDEC3',
      scrub_a: '#E3EBDA',
      scrub_b: '#D6E3CB',
      buildings: '#E0E2DC',
    }),
    sprite: 'light',
    casing: '#FFFFFF',
    contrast: INK,
    halo: '#FFFFFF',
    lights: LIGHTS_ON_PALE,
  },
  grey: {
    flavor: plain(namedFlavor('grayscale')),
    sprite: 'grayscale',
    casing: '#FFFFFF',
    contrast: INK,
    halo: '#FFFFFF',
    lights: LIGHTS_ON_PALE,
  },
  // A pale outline keeps the darkest data colour visible on the dark ground.
  dark: {
    flavor: plain(namedFlavor('dark')),
    sprite: 'dark',
    casing: '#AEBBC4',
    contrast: '#FFFFFF',
    halo: '#14191C',
    lights: LIGHTS_ON_DARK,
  },
  // Only the labels are drawn, so they are brightened to read over photos.
  satellite: {
    flavor: plain({
      ...namedFlavor('dark'),
      city_label: '#FFFFFF',
      city_label_halo: '#101010',
      subplace_label: '#F2F2F2',
      subplace_label_halo: '#101010',
      roads_label_major: '#FFFFFF',
      roads_label_major_halo: '#101010',
      roads_label_minor: '#F2F2F2',
      roads_label_minor_halo: '#101010',
      ocean_label: '#DCEBFF',
      address_label: '#F2F2F2',
      address_label_halo: '#101010',
    }),
    sprite: 'dark',
    casing: '#0E1316',
    contrast: '#FFFFFF',
    halo: '#101010',
    imagery: true,
    lights: LIGHTS_ON_DARK,
  },
}

/** The dark map with the street lights on: near black, so the lights carry the picture. */
const NIGHT_THEME: Theme = {
  flavor: plain({
    ...namedFlavor('black'),
    background: '#05070A',
    earth: '#0A0D11',
    water: '#03050A',
    buildings: '#10141A',
  }),
  sprite: 'dark',
  casing: '#0E1316',
  contrast: '#FFFFFF',
  halo: '#05070A',
  lights: LIGHTS_ON_DARK,
}

const IMAGERY_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
const IMAGERY_ATTRIBUTION = 'Imagery © Esri, Maxar, Earthstar Geographics'

function lineWidth(extra = 0): ExpressionSpecification {
  return ['interpolate', ['exponential', 1.5], ['zoom'], 9, 0.8 + extra, 13, 2.2 + extra, 16, 5 + extra, 19, 12 + extra]
}

/** The route's stretches, each with its part of the view on show and that part's colour. */
function routeData(route: Route | null, view: RouteView): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.segments ?? []).map((segment) => {
      const part = partOf(segment, view)
      return {
        type: 'Feature',
        properties: { part, color: partLook(view, part).color },
        geometry: { type: 'LineString', coordinates: segment.coords },
      }
    }),
  }
}

/** A route's point halfway along it, where its bubble goes. */
function halfway(route: Route): [number, number] | null {
  const { coords } = route
  if (!coords.length) return null
  const kx = Math.cos((coords[0][1] * Math.PI) / 180)
  const lengths = coords.map((point, i) =>
    i ? Math.hypot((point[0] - coords[i - 1][0]) * kx, point[1] - coords[i - 1][1]) : 0,
  )
  const half = lengths.reduce((sum, n) => sum + n, 0) / 2
  let along = 0
  for (let i = 1; i < coords.length; i++) {
    along += lengths[i]
    if (along >= half) return [coords[i][0], coords[i][1]]
  }
  return [coords[0][0], coords[0][1]]
}

/** The routes not chosen: each as a line, and a point halfway along it for its time. */
function otherRoutesData(others: StyleState['routeOthers']): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (others ?? []).flatMap(({ route, choice }) => {
      const middle = halfway(route)
      return [
        {
          type: 'Feature' as const,
          properties: { choice },
          geometry: { type: 'LineString' as const, coordinates: route.coords.map(([lon, lat]) => [lon, lat]) },
        },
        ...(middle
          ? [
              {
                type: 'Feature' as const,
                properties: { choice, label: `${Math.max(1, Math.round(route.time / 60))} min` },
                geometry: { type: 'Point' as const, coordinates: middle },
              },
            ]
          : []),
      ]
    }),
  }
}

function stopsData(route: Route | null): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (route?.stops ?? []).map((stop) => ({
      type: 'Feature',
      properties: {
        kind: stop.kind,
        ...(stop.barrier && { barrier: stop.barrier }),
        ...(stop.closure && { closure: stop.closure }),
        ...(stop.label && { label: stop.label }),
      },
      geometry: { type: 'Point', coordinates: stop.lngLat },
    })),
  }
}

/** Name of the map image for a stop sign, traffic light or barrier on the route. */
export function stopImageId(kind: StopKind | ''): string {
  return `route-${kind}`
}

/** Marks the stretches picked out from the route's breakdown. */
const HIGHLIGHT_COLOR = '#FFD60A'

/** Colour of a trip's routes not chosen. */
const OTHER_ROUTE_COLOR = '#7F8C92'

/** Colour of a walking route. */
const WALK_ROUTE_COLOR = '#0B6E6E'

function routeLayers(
  theme: Theme,
  highlight: RouteHighlight | null,
  onFoot: boolean,
  dimOthers: boolean,
  stops: boolean,
): LayerSpecification[] {
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  // With something picked out, everything else on the route fades so it is easy to find.
  const rest: ExpressionSpecification | number = highlight ? ['case', ['==', ['get', 'part'], highlight], 1, 0.3] : 1
  const otherStops: ExpressionSpecification | number = highlight
    ? ['case', ['==', ['get', 'kind'], highlight], 1, 0.3]
    : 1
  const lines: FilterSpecification = ['==', ['geometry-type'], 'LineString']
  return [
    // The trip's other routes, grey under the chosen one, to pick from.
    {
      id: 'route-others-casing',
      type: 'line',
      source: 'route-others',
      filter: lines,
      layout: round,
      paint: { 'line-color': '#ffffff', 'line-width': lineWidth(6), 'line-opacity': dimOthers ? 0.3 : 0.85 },
    },
    {
      id: 'route-others-line',
      type: 'line',
      source: 'route-others',
      filter: lines,
      layout: round,
      paint: { 'line-color': OTHER_ROUTE_COLOR, 'line-width': lineWidth(3), 'line-opacity': dimOthers ? 0.3 : 1 },
    },
    {
      id: 'route-highlight',
      type: 'line',
      source: 'route',
      filter: ['==', ['get', 'part'], highlight ?? ''],
      layout: round,
      paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': lineWidth(16) },
    },
    {
      id: 'route-casing',
      type: 'line',
      source: 'route',
      layout: round,
      paint: { 'line-color': theme.contrast, 'line-width': lineWidth(8), 'line-opacity': rest },
    },
    {
      id: 'route-line',
      type: 'line',
      source: 'route',
      layout: round,
      paint: {
        'line-color': onFoot ? WALK_ROUTE_COLOR : ['get', 'color'],
        'line-width': lineWidth(3.5),
        'line-opacity': rest,
      },
    },
    {
      id: 'route-stops-highlight',
      type: 'circle',
      source: 'route-stops',
      filter: ['==', ['get', 'kind'], highlight ?? ''],
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 9, 15, 18, 18, 24],
        'circle-color': HIGHLIGHT_COLOR,
        'circle-stroke-color': theme.contrast,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'route-stops',
      type: 'symbol',
      source: 'route-stops',
      ...(!stops && { filter: ['==', ['get', 'kind'], highlight ?? ''] }),
      // Too many to show from far out, unless they are what is being looked for.
      minzoom: (STOP_KINDS as readonly string[]).includes(highlight ?? '') ? 0 : 12,
      layout: {
        // Drawn on demand by the map view.
        'icon-image': ['concat', stopImageId(''), ['get', 'kind']],
        'icon-size': ['interpolate', ['linear'], ['zoom'], 12, 0.75, 15, 1.2, 18, 1.6],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
      paint: { 'icon-opacity': otherStops },
    },
  ]
}

/**
 * Barriers and roadwork picked out on the route say what they are in a bubble
 * above them, over everything else on the map.
 */
function routeBubbleLayers(highlight: RouteHighlight | null): LayerSpecification[] {
  if (highlight !== 'barrier' && highlight !== 'roadwork') return []
  return [
    {
      id: 'route-stops-bubble',
      type: 'symbol',
      source: 'route-stops',
      filter: ['all', ['==', ['get', 'kind'], highlight], ['has', 'label']],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-max-width': 14,
        'text-anchor': 'bottom',
        // Clear of the yellow ring below, which grows with the zoom: its radius, the tail, a gap.
        'text-offset': [
          'interpolate',
          ['linear'],
          ['zoom'],
          12,
          ['literal', [0, -1.9]],
          15,
          ['literal', [0, -2.4]],
          18,
          ['literal', [0, -2.9]],
        ],
        'icon-image': BUBBLE_IMAGE,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 7, 3, 7],
        // Only the few picked out get one: each shows, over the map's own labels.
        'text-allow-overlap': true,
        'icon-allow-overlap': true,
      },
      paint: { 'text-color': '#16242b' },
    },
  ]
}

/**
 * Each route not chosen says how long it takes, in a bubble halfway along it;
 * a click picks it. None while the chosen route is looked at closely.
 */
function otherRouteLabelLayers(dim: boolean): LayerSpecification[] {
  if (dim) return []
  return [
    {
      id: 'route-others-label',
      type: 'symbol',
      source: 'route-others',
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['get', 'label'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-anchor': 'bottom',
        'text-offset': [0, -0.9],
        'icon-image': BUBBLE_IMAGE,
        'icon-text-fit': 'both',
        'icon-text-fit-padding': [3, 7, 3, 7],
        'text-allow-overlap': true,
        'icon-allow-overlap': true,
      },
      paint: { 'text-color': '#16242b' },
    },
  ]
}

/** Source of the reach lines, filled in by the map view. */
export const REACH_SOURCE = 'reach'

/**
 * The minutes at each band's edge of the reach area, in a row out from the
 * start. Over the street names, which make way for them; where two bands end
 * together, the closer one is labelled.
 */
function reachLabelLayers(reach: StyleState['reach'], basemap: BasemapId, theme: Theme): LayerSpecification[] {
  if (!reach?.area) return []
  return [
    {
      id: 'reach-band-label',
      type: 'symbol',
      source: REACH_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'text-field': ['concat', ['to-string', ['get', 'minutes']], ' min'],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'symbol-sort-key': ['get', 'minutes'],
      },
      paint: { 'text-color': reachRamp(basemap)[0], 'text-halo-color': theme.halo, 'text-halo-width': 2 },
    },
  ]
}

function reachLayers(reach: StyleState['reach'], basemap: BasemapId): LayerSpecification[] {
  if (!reach) return []
  const ramp = reachRamp(basemap)
  const last = ramp.length - 1
  const color = [
    'interpolate',
    ['linear'],
    ['get', 'minutes'],
    ...ramp.flatMap((color, i) => [1 + ((reach.minutes - 1) * i) / last, color]),
  ] as ExpressionSpecification
  if (reach.area) {
    // Bands of time, nested: each sees the map through it, so the closest,
    // under all of them, is the strongest.
    return [
      {
        id: 'reach-area',
        type: 'fill',
        source: REACH_SOURCE,
        filter: ['==', ['geometry-type'], 'Polygon'],
        layout: { 'fill-sort-key': ['-', ['get', 'minutes']] },
        paint: { 'fill-color': color, 'fill-opacity': 0.22 },
      },
      {
        id: 'reach-edge',
        type: 'line',
        source: REACH_SOURCE,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'minutes'], reach.minutes]],
        layout: { 'line-join': 'round' },
        paint: { 'line-color': ramp[Math.floor(last / 2)], 'line-width': 1.5 },
      },
    ]
  }
  return [
    {
      id: 'reach-line',
      type: 'line',
      source: REACH_SOURCE,
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        // The closest minutes are drawn on top.
        'line-sort-key': ['-', ['get', 'minutes']],
      },
      paint: { 'line-color': color, 'line-width': lineWidth() },
    },
  ]
}

/** Pathways as wide as they are, relative to a 3 m path; those without a width as if 1.5 m. */
function pathwayWidth(extra = 0): ExpressionSpecification {
  const factor = ['min', 1.5, ['max', 0.4, ['/', ['coalesce', ['get', 'width_m'], UNKNOWN_WIDTH], 3]]]
  return [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    ...[9, 13, 16, 19].flatMap((zoom, i) => [zoom, ['+', ['*', [1.2, 3, 6.5, 15][i], factor], extra]]),
  ] as ExpressionSpecification
}

/**
 * Pathways coloured by the legend's open row (surface at first), in yellow
 * where that is not tagged yet; those go on top, so the gaps show.
 */
function pathwayLayers(state: StyleState, fade: number): LayerSpecification[] {
  const filters = state.pathways ?? DEFAULT_PATHWAY_FILTERS
  const by = colorBy(filters)
  const colors = pathwaySetColors(state.basemap)[by]
  const pale = state.basemap === 'light' || state.basemap === 'grey'
  const group = pathwayGroupOf(by)
  const unknown: ExpressionSpecification = ['==', group, 'unknown']
  const color = [
    'match',
    group,
    ...Object.entries(colors).flat(),
    pathwayColors(state.basemap).unknown,
  ] as unknown as ExpressionSpecification
  const layout = {
    'line-cap': 'round' as const,
    'line-join': 'round' as const,
    'line-sort-key': ['case', unknown, 1, 0] as ExpressionSpecification,
    visibility: state.layer === 'pathways' && !state.reach ? ('visible' as const) : ('none' as const),
  }
  const way = { type: 'line' as const, source: WAYS_SOURCE, 'source-layer': 'ways', filter: pathwayFilter(filters) }
  return [
    {
      ...way,
      id: 'pathways-casing',
      layout,
      paint: {
        'line-color': pale ? 'rgba(22, 36, 43, 0.45)' : 'rgba(0, 0, 0, 0.6)',
        'line-width': pathwayWidth(1.5),
        'line-opacity': fade,
      },
    },
    {
      ...way,
      id: 'pathways-line',
      layout,
      paint: { 'line-color': color, 'line-width': pathwayWidth(), 'line-opacity': fade },
    },
  ]
}

function overlayLayers(state: StyleState, theme: Theme): LayerSpecification[] {
  // The data steps back when a planned route is drawn over it.
  const fade = state.route ? 0.35 : 1
  // The reach map has the street lines to itself; the data lines share its blues.
  const show = (layer: LayerId) => ({
    visibility: state.layer === layer && !state.reach ? ('visible' as const) : ('none' as const),
  })
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  const bikeable: FilterSpecification = ['>', ['get', 'lts'], 0]
  // The comfort layer's picks, on top.
  const comfort = state.comfort ?? DEFAULT_COMFORT_FILTERS
  const comfortable: FilterSpecification = ['all', bikeable, comfortFilter(comfort)]
  // Coloured by the legend's open row, stress at first.
  const comfortColors = Object.entries(comfortSetColors()[comfortColorBy(comfort)])
  const comfortColor = [
    'match',
    comfortGroupOf(comfortColorBy(comfort)),
    ...comfortColors.flat(),
    '-',
    NOT_APPLICABLE,
    OTHER,
  ] as unknown as ExpressionSpecification
  const selectedWay: FilterSpecification = ['==', ['id'], state.selected?.kind === 'way' ? state.selected.id : -1]
  const selectedPlace: FilterSpecification = [
    '==',
    ['get', 'osm'],
    state.selected?.kind === 'place' ? state.selected.osm : '',
  ]
  const way = { type: 'line' as const, source: WAYS_SOURCE, 'source-layer': 'ways' }
  const place = { type: 'circle' as const, source: PLACES_SOURCE, 'source-layer': 'places' }

  const [pathwayCasing, pathwayLine] = pathwayLayers(state, fade)
  const wayLayers: LayerSpecification[] = [
    pathwayCasing,
    {
      ...way,
      id: 'comfort-casing',
      filter: comfortable,
      layout: { ...round, ...show('comfort') },
      paint: { 'line-color': theme.casing, 'line-width': lineWidth(1.5), 'line-opacity': 0.7 * fade },
    },
    {
      ...way,
      id: 'selected-way',
      filter: selectedWay,
      layout: round,
      paint: { 'line-color': theme.contrast, 'line-width': lineWidth(7) },
    },
    {
      ...way,
      id: 'comfort-line',
      filter: comfortable,
      layout: { ...round, ...show('comfort') },
      paint: {
        'line-color': comfortColor,
        'line-width': lineWidth(),
        'line-opacity': fade,
      },
    },
    pathwayLine,
  ]
  const placeLayers: LayerSpecification[] = [
    {
      ...place,
      id: 'selected-place',
      filter: selectedPlace,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 12, 14, 16, 17, 20],
        'circle-color': theme.contrast,
        'circle-opacity': 0.35,
      },
    },
  ]
  // Each tile set is only in the style, and so only downloaded, while it is shown.
  return [...(showsWays(state) ? wayLayers : []), ...(loadsPlaces(state) ? placeLayers : [])]
}

/** Street data (comfort, pathways) is drawn on those layers, except under the reach map. */
function showsWays(state: StyleState): boolean {
  return (state.layer === 'comfort' || state.layer === 'pathways') && !state.reach
}

/** Places are drawn on their layer, once at least one kind is ticked (none is, to begin with). */
function showsPlaces(state: StyleState): boolean {
  return state.layer === 'places' && state.placeKinds.length > 0
}

/**
 * The places tile set also loads for a selected place, so one found by a
 * search is picked out, and its details read, whatever kinds are ticked.
 */
function loadsPlaces(state: StyleState): boolean {
  return showsPlaces(state) || state.selected?.kind === 'place'
}

/** Street data and places come in tile sets of their own, so each loads only for its layer. */
const WAYS_SOURCE = 'overlays'
const ROUTES_SOURCE = 'routes'

const byLevel = (colors: Record<RouteLevelId, string>): ExpressionSpecification => [
  'match',
  ['get', 'level'],
  'national',
  colors.national,
  'regional',
  colors.regional,
  'local',
  colors.local,
  colors.mtb,
]

/**
 * Signed bike routes as soft wide bands under the bike lanes, coloured by rank;
 * a picked route ringed in yellow. Their names go with the street names.
 */
function routeBandLayers(state: StyleState): LayerSpecification[] {
  if (!state.bikeRoutes) return []
  const route = { type: 'line' as const, source: ROUTES_SOURCE, 'source-layer': 'routes' }
  const width = (scale: number): ExpressionSpecification => [
    'interpolate',
    ['exponential', 1.5],
    ['zoom'],
    ...[9, 13, 16, 19].flatMap((zoom, i) => [zoom, [3.5, 8, 16, 32][i] * scale]),
  ]
  const focus = state.selected?.kind === 'route' ? state.selected.focus : ''
  return [
    {
      ...route,
      id: 'routes-picked',
      filter: ['in', `,${focus},`, ['get', 'all']],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': HIGHLIGHT_COLOR, 'line-width': width(1.6) },
    },
    {
      ...route,
      id: 'routes-band',
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        // The highest-ranked route on top where they meet.
        'line-sort-key': ['match', ['get', 'level'], 'national', 3, 'regional', 2, 'local', 1, 0],
      },
      paint: { 'line-color': byLevel(routeBandColors(state.basemap)), 'line-width': width(1) },
    },
  ]
}

function routeLabelLayers(state: StyleState, theme: Theme): LayerSpecification[] {
  if (!state.bikeRoutes) return []
  return [
    {
      id: 'routes-label',
      type: 'symbol',
      source: ROUTES_SOURCE,
      'source-layer': 'routes',
      layout: {
        'symbol-placement': 'line',
        'symbol-spacing': 400,
        'text-field': ['coalesce', ['get', 'label'], ''],
        'text-font': ['Noto Sans Medium'],
        'text-size': 12,
        'text-max-angle': 30,
      },
      paint: { 'text-color': byLevel(ROUTE_COLORS), 'text-halo-color': theme.halo, 'text-halo-width': 2 },
    },
  ]
}

/**
 * Bike lanes over the basemap: dedicated ways solid green, painted lanes dashed,
 * shared lanes dotted, paved shoulders yellow. Under the data layers, How far's
 * lines and the street names.
 */
function bikeLaneLayers(state: StyleState): LayerSpecification[] {
  if (!state.bikeLanes) return []
  const colors = bikewayColors(state.basemap)
  const way = { type: 'line' as const, source: WAYS_SOURCE, 'source-layer': 'ways' }
  // Line width by zoom, from the full width at each zoom stop.
  const byZoom = (value: (full: number) => unknown) =>
    [
      'interpolate',
      ['exponential', 1.5],
      ['zoom'],
      ...[9, 13, 16, 19].flatMap((zoom, i) => [zoom, value([0.6, 2, 4.8, 11.8][i])]),
    ] as ExpressionSpecification
  // Lines as wide as the bikeway, relative to a 3 m two-way path drawn at the
  // full width; held between about a third and one and a half of it so that
  // trails and plazas stay readable.
  const scaled = (key: string) => {
    const factor = ['min', 1.5, ['max', 0.35, ['/', ['coalesce', ['get', key], 3], 3]]]
    return byZoom((full) => ['*', full, factor])
  }
  const width = scaled('bikeway_width')
  const whole: FilterSpecification = ['all', ['!', ['has', 'bikeway_left']], ['!', ['has', 'bikeway_right']]]
  // Told apart by pattern as well as colour: dedicated solid, painted lanes in
  // long dashes, shared lanes in dots, shoulders solid but yellow. Dash lengths
  // are in line widths; the dashes have square ends so they stay long, the dots
  // round ones.
  const looks: Record<BikewayId, { cap: 'round' | 'butt'; dash?: number[] }> = {
    dedicated: { cap: 'round' },
    lane: { cap: 'butt', dash: [3, 1.5] },
    shared: { cap: 'round', dash: [0, 2] },
    shoulder: { cap: 'round' },
  }
  // On the comfort layer, the bike lanes follow its picks: picking primary roads shows their lanes alone.
  const comfort = state.comfort ?? DEFAULT_COMFORT_FILTERS
  const picks = state.layer === 'comfort' && comfortPicked(comfort) ? comfortFilter(comfort) : null
  const layer = (
    id: string,
    kind: BikewayId,
    filter: FilterSpecification,
    lineWidth: ExpressionSpecification,
    offset?: ExpressionSpecification,
  ): LayerSpecification => ({
    ...way,
    id,
    filter: picks ? (['all', filter, picks] as FilterSpecification) : filter,
    layout: { 'line-cap': looks[kind].cap, 'line-join': 'round' },
    paint: {
      'line-color': colors[kind],
      'line-width': lineWidth,
      ...(offset && { 'line-offset': offset }),
      ...(looks[kind].dash && { 'line-dasharray': looks[kind].dash }),
    },
  })
  // Streets: a line down each side that has a bike lane, left and right as the
  // way is drawn. Paths, which have no sides, are one line down the middle.
  // Dedicated ways go on top where they meet the others.
  const order: BikewayId[] = ['shoulder', 'shared', 'lane', 'dedicated']
  const sideLayers = (['left', 'right'] as const).flatMap((side) =>
    order.map((kind) =>
      layer(
        `bike-lanes-${side}-${kind}`,
        kind,
        ['==', ['get', `bikeway_${side}`], kind],
        scaled(`bikeway_${side}_width`),
        byZoom((full) => (side === 'left' ? -0.45 : 0.45) * full),
      ),
    ),
  )
  const wholeLayers = order.map((kind) =>
    layer(`bike-lanes-${kind}`, kind, ['all', whole, ['==', ['get', 'bikeway'], kind]], width),
  )
  return [...sideLayers, ...wholeLayers]
}

export const PLACES_SOURCE = 'places'
/** A group's places picked, merged with each other where they would overlap until PLACES_MERGED_UNTIL: source and layer. */
function mergedPlacesId(group: PlaceGroupId): string {
  return `places-merged-${group}`
}

/** The groups with a kind picked. */
const pickedGroups = (state: StyleState) =>
  PLACE_GROUP_IDS.filter((group) => state.placeKinds.some((kind) => placeGroup(kind) === group))
const PLACES_MERGED_UNTIL = 14
/** Zoom from which every place has its own marker, with its details. */
export const PLACES_UNMERGED_FROM = PLACES_MERGED_UNTIL + 1
/** How close places are merged, in pixels. */
const PLACES_MERGE_RADIUS = 32

/** Lit streets hand over to the individual lamps between these zooms. */
const STREETS_UNTIL = 14.5
const LAMPS_FROM = 12.5

/**
 * The city by its street lights. Zoomed out, streets with lamps along them glow
 * as lines; zooming in, the lines fade and the lamps themselves take over, first
 * as a blur and from zoom 14 as dots too. The glow goes under the data lines, so
 * a lit way shows as a halo around its colour; the lamp dots go over them.
 */
function lightLayers(state: StyleState, theme: Theme): { under: LayerSpecification[]; over: LayerSpecification[] } {
  if (!state.lights || state.reach) return { under: [], over: [] }
  const layers = streetLightLayers(theme)
  return { under: layers.filter((l) => l.id !== 'night-lamps'), over: layers.filter((l) => l.id === 'night-lamps') }
}

const streetLightLayers = ({ lights }: Theme): LayerSpecification[] => [
  {
    id: 'night-streets-glow',
    type: 'line',
    source: 'night',
    'source-layer': 'streets',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': lights.glow,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 6, 14, 11],
      'line-blur': ['interpolate', ['linear'], ['zoom'], 9, 3, 12, 5, 14, 9],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 0.5, 13, 0.4, STREETS_UNTIL, 0],
    },
  },
  {
    id: 'night-streets',
    type: 'line',
    source: 'night',
    'source-layer': 'streets',
    layout: { 'line-cap': 'round', 'line-join': 'round' },
    paint: {
      'line-color': lights.lamp,
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.7, 12, 1.2, 14, 2],
      'line-blur': 0.6,
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 9, 0.95, 13, 0.85, STREETS_UNTIL, 0],
    },
  },
  {
    id: 'night-glow',
    type: 'heatmap',
    source: 'night',
    'source-layer': 'lamps',
    minzoom: 12,
    paint: {
      // Per-lamp brightness, raised as the map zooms in and lamps spread apart.
      'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 12, 0.12, 13, 0.3, 14, 0.45, 16, 0.6],
      'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 12, 6, 13, 9, 14, 12, 16, 26, 18, 50],
      'heatmap-color': [
        'interpolate',
        ['linear'],
        ['heatmap-density'],
        0,
        lights.heat[0],
        0.08,
        lights.heat[1],
        0.35,
        lights.heat[2],
        0.7,
        lights.heat[3],
        1,
        lights.heat[4],
      ],
      'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], LAMPS_FROM, 0, 13.5, 1, 15, 1, 18, 0.6],
    },
  },
  {
    id: 'night-lamps',
    type: 'circle',
    source: 'night',
    'source-layer': 'lamps',
    minzoom: 14,
    paint: {
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 1.2, 16, 2.4, 18, 4.5],
      'circle-color': lights.lamp,
      'circle-blur': 0.3,
      'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0.5, 16, 1],
    },
  },
]

/** Zoom from which places show their name beside the marker. */
const PLACE_LABEL_ZOOM = 15

/**
 * Markers for the places layer, named when zoomed in. Kept apart from the other
 * data layers because it sits above the basemap's labels: MapLibre gives the
 * topmost labels first pick, and here a shop's name matters more than the street's.
 */
export const WARDS_SOURCE = 'wards'
const WARDS_ATTRIBUTION =
  'Wards: <a href="https://open.ottawa.ca/" target="_blank" rel="noopener">City of Ottawa</a>, <a href="https://www.donneesquebec.ca/organisation/ville-de-gatineau/" target="_blank" rel="noopener">Ville de Gatineau</a>'

/**
 * Ward and district boundaries, dashed, with each ward's name and councillor
 * at a spot well inside it (worked out by pipeline/fetch-wards.mjs).
 */
function wardLayers(state: StyleState, theme: Theme): { lines: LayerSpecification[]; labels: LayerSpecification[] } {
  if (!state.wards) return { lines: [], labels: [] }
  const colors = wardColors(state.basemap)
  const color: ExpressionSpecification = ['match', ['get', 'city'], 'gatineau', colors.gatineau, colors.ottawa]
  const name = ['get', state.lang === 'fr' ? 'name_fr' : 'name_en'] as ExpressionSpecification
  return {
    // A soft band under a dashed line, so the boundary shows among busy streets.
    lines: [
      {
        id: 'wards-band',
        type: 'line',
        source: WARDS_SOURCE,
        filter: ['!=', ['geometry-type'], 'Point'],
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 4, 14, 9],
          'line-opacity': 0.25,
        },
      },
      {
        id: 'wards-line',
        type: 'line',
        source: WARDS_SOURCE,
        filter: ['!=', ['geometry-type'], 'Point'],
        layout: { 'line-join': 'round' },
        paint: {
          'line-color': color,
          'line-width': ['interpolate', ['linear'], ['zoom'], 9, 1.4, 14, 2.4],
          'line-dasharray': [3, 2],
        },
      },
    ],
    labels: [
      {
        id: 'wards-label',
        type: 'symbol',
        source: WARDS_SOURCE,
        filter: ['==', ['geometry-type'], 'Point'],
        minzoom: 10,
        layout: {
          'text-field': ['format', name, { 'font-scale': 1 }, '\n', {}, ['get', 'councillor'], { 'font-scale': 0.85 }],
          'text-font': ['Noto Sans Medium'],
          'text-size': ['interpolate', ['linear'], ['zoom'], 10, 11, 14, 14],
          'text-max-width': 10,
          'text-padding': 8,
        },
        paint: { 'text-color': color, 'text-halo-color': theme.halo, 'text-halo-width': 2 },
      },
    ],
  }
}

export const COLLISIONS_SOURCE = 'collisions'
/** The same spots, merged where they would overlap; the heat maps use them each alone. */
export const COLLISION_SPOTS_SOURCE = 'collision-spots'
export const THEFT_SPOTS_SOURCE = 'theft-spots'
const COLLISIONS_ATTRIBUTION =
  'Collisions: <a href="https://open.ottawa.ca/" target="_blank" rel="noopener">City of Ottawa</a>'
export const CONSTRUCTION_SOURCE = 'construction'
export const CLOSURES_SOURCE = 'closures'
const CLOSURES_ATTRIBUTION =
  'Roadwork: <a href="https://traffic.ottawa.ca/map/" target="_blank" rel="noopener">City of Ottawa</a>, <a href="https://www.quebec511.info" target="_blank" rel="noopener">Québec 511</a>'
const CONSTRUCTION_ATTRIBUTION =
  'Construction: <a href="https://ottawa.ca/en/parking-roads-and-travel/road-construction-and-maintenance" target="_blank" rel="noopener">City of Ottawa</a>'
export const THEFTS_SOURCE = 'thefts'
const THEFTS_ATTRIBUTION =
  'Thefts: <a href="https://www.ottawapolice.ca/" target="_blank" rel="noopener">Ottawa Police Service</a>'
/** The router's elevation (MRDEM-30), shown with a route. */
const ELEVATION_ATTRIBUTION =
  'Elevation: <a href="https://open.canada.ca/en/open-government-licence-canada" target="_blank" rel="noopener">NRCan</a>'

const COLLISION_POINTS_FROM = SPOTS_FROM

/**
 * Collision or theft spots, sized by their count, merged where they would
 * overlap until MERGED_UNTIL. Coloured by a group, the ones big enough show
 * their split as a pie (the `p0`… counts, in the groups' order); smaller ones
 * take the colour most of their items share and are drawn over the pies, as
 * smaller spots are drawn over bigger ones.
 */
function spotLayers(
  layer: 'collisions' | 'thefts',
  color: ExpressionSpecification,
  pale: boolean,
  pies: readonly string[] | null,
): LayerSpecification[] {
  const ring = pale ? '#ffffff' : '#111417'
  const fadeIn: ExpressionSpecification = [
    'interpolate',
    ['linear'],
    ['zoom'],
    COLLISION_POINTS_FROM,
    0,
    COLLISION_POINTS_FROM + 0.7,
    1,
  ]
  const source = layer === 'collisions' ? COLLISION_SPOTS_SOURCE : THEFT_SPOTS_SOURCE
  // Bigger spots first, so smaller ones are drawn over them.
  const sortKey: ExpressionSpecification = ['-', ['get', 'count']]
  const points: LayerSpecification = {
    id: `${layer}-point`,
    type: 'circle',
    source,
    minzoom: COLLISION_POINTS_FROM,
    ...(pies && { filter: ['!', isPie] as unknown as FilterSpecification }),
    layout: { 'circle-sort-key': sortKey },
    paint: {
      'circle-color': color,
      'circle-radius': spotRadius,
      'circle-stroke-color': ring,
      'circle-stroke-width': 1,
      'circle-opacity': fadeIn,
      'circle-stroke-opacity': fadeIn,
    },
  }
  if (!pies) return [points]
  return [
    {
      id: `${layer}-pie`,
      type: 'symbol',
      source,
      minzoom: COLLISION_POINTS_FROM,
      filter: isPie as unknown as FilterSpecification,
      layout: {
        'icon-image': pieImage(pies, ring),
        'icon-size': pieSize,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'symbol-sort-key': sortKey,
      },
      paint: { 'icon-opacity': fadeIn },
    },
    points,
  ]
}

/**
 * Collisions involving cyclists or pedestrians: where they cluster, zoomed
 * out, and each spot zoomed in, sized by how many happened there and coloured
 * by the worst injury among them, or by the legend's open row.
 */
function collisionLayers(state: StyleState): { under: LayerSpecification[]; over: LayerSpecification[] } {
  if (state.layer !== 'collisions' || state.reach) return { under: [], over: [] }
  const colors = collisionColors(state.basemap)
  // With no row open, the worst injury among a spot's collisions; with one, its groups' split.
  const by = state.collisionsBy ?? null
  const pies = by
    ? collisionGroups(by).map((group) =>
        by === 'party' ? partyColor(group) : by === 'severity' ? colors[group as Severity] : conditionColor(by, group),
      )
    : null
  const byWorst = pies
    ? mostCommon(pies)
    : ([
        'match',
        ['get', 'worst'],
        ...SEVERITIES.flatMap((s, i) => [i, colors[s]]),
        colors.none,
      ] as unknown as ExpressionSpecification)
  const pale = state.basemap === 'light' || state.basemap === 'grey'
  return {
    under: [
      {
        id: 'collisions-heat',
        type: 'heatmap',
        source: COLLISIONS_SOURCE,
        maxzoom: COLLISION_POINTS_FROM + 1,
        paint: {
          // Each spot weighs its injuries, worse ones more.
          'heatmap-weight': ['get', 'weight'],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 14, 13.5, 22],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.15,
            pale ? 'rgba(242, 148, 112, 0.45)' : 'rgba(122, 59, 46, 0.5)',
            0.4,
            colors.minor,
            0.7,
            colors.major,
            1,
            colors.fatal,
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COLLISION_POINTS_FROM,
            0.85,
            COLLISION_POINTS_FROM + 1,
            0,
          ],
        },
      },
    ],
    over: spotLayers('collisions', byWorst, pale, pies),
  }
}

/**
 * Bike thefts: where they cluster, zoomed out, and each intersection zoomed
 * in, sized by how many bikes were taken there.
 */
function theftLayers(state: StyleState): { under: LayerSpecification[]; over: LayerSpecification[] } {
  if (state.layer !== 'thefts' || state.reach) return { under: [], over: [] }
  const { values, noValue, heat } = theftColors(state.basemap)
  // Coloured by the dollars stolen there, a step per band, grey where none was
  // given; or, with a row open in the legend, by what most of its thefts share.
  const by = state.theftsBy
  const pies = by ? THEFT_GROUPS[by].map((group) => theftGroupColor(by, group)) : null
  const byValue = pies
    ? mostCommon(pies)
    : ([
        'case',
        ['==', ['get', 'valued'], 0],
        noValue,
        ['step', ['get', 'value'], values[0], ...VALUE_STEPS.flatMap((step, i) => [step, values[i + 1]])],
      ] as unknown as ExpressionSpecification)
  const pale = state.basemap === 'light' || state.basemap === 'grey'
  return {
    under: [
      {
        id: 'thefts-heat',
        type: 'heatmap',
        source: THEFTS_SOURCE,
        maxzoom: COLLISION_POINTS_FROM + 1,
        paint: {
          // Even one theft shows when filters leave few; busy spots saturate.
          'heatmap-weight': ['min', 1, ['+', 0.4, ['*', 0.15, ['get', 'count']]]],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 9, 6, 12, 14, 13.5, 22],
          'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 9, 0.6, 13, 1.2],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0,
            'rgba(0, 0, 0, 0)',
            0.15,
            heat[0],
            0.4,
            heat[1],
            0.7,
            heat[2],
            1,
            heat[3],
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            COLLISION_POINTS_FROM,
            0.85,
            COLLISION_POINTS_FROM + 1,
            0,
          ],
        },
      },
    ],
    over: spotLayers('thefts', byValue, pale, pies),
  }
}

/**
 * Projects: the City's construction projects, lines along the streets and
 * paths and points for the rest, coloured by the legend's open row: when the
 * work happens at first, or what kind it is.
 */
function constructionLayers(state: StyleState): { under: LayerSpecification[]; over: LayerSpecification[] } {
  if (state.layer !== 'construction' || state.reach) return { under: [], over: [] }
  const f = state.construction ?? DEFAULT_CONSTRUCTION_FILTERS
  const colors = constructionColors(state.basemap)
  const pale = state.basemap === 'light' || state.basemap === 'grey'
  const color = (constructionColorBy(f) === 'kind'
    ? ['match', ['get', 'kind'], ...Object.entries(CONSTRUCTION_KIND_COLORS).flat(), OTHER]
    : [
        'match',
        ['get', 'timing'],
        ...CONSTRUCTION_TIMINGS.flatMap((timing) => [timing, colors[timing]]),
        colors.later,
      ]) as unknown as ExpressionSpecification
  const chosen = constructionFilter(f)
  const lines: FilterSpecification = ['all', ['==', ['geometry-type'], 'LineString'], chosen]
  const points: FilterSpecification = ['all', ['==', ['geometry-type'], 'Point'], chosen]
  const selected = state.selected?.kind === 'construction' ? String(state.selected.props.id) : ''
  const width = (low: number, high: number): ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    low,
    16,
    high,
  ]
  const round = { 'line-cap': 'round' as const, 'line-join': 'round' as const }
  return {
    under: [
      {
        id: 'construction-casing',
        type: 'line',
        source: CONSTRUCTION_SOURCE,
        filter: lines,
        layout: round,
        paint: { 'line-color': pale ? '#ffffff' : '#111417', 'line-width': width(4, 10), 'line-opacity': 0.9 },
      },
      {
        id: 'construction-selected',
        type: 'line',
        source: CONSTRUCTION_SOURCE,
        filter: ['==', ['get', 'id'], selected],
        layout: round,
        paint: { 'line-color': '#FFD60A', 'line-width': width(9, 18) },
      },
      {
        id: 'construction-line',
        type: 'line',
        source: CONSTRUCTION_SOURCE,
        filter: lines,
        layout: round,
        paint: { 'line-color': color, 'line-width': width(2, 6) },
      },
    ],
    over: [
      {
        id: 'construction-point',
        type: 'circle',
        source: CONSTRUCTION_SOURCE,
        filter: points,
        paint: {
          'circle-color': color,
          'circle-radius': width(3, 7),
          'circle-stroke-color': pale ? '#ffffff' : '#111417',
          'circle-stroke-width': 1,
        },
      },
    ],
  }
}

/** The roadwork overlay: a cone at each closure on the City's traffic map, over any layer. */
function roadworkLayers(state: StyleState): LayerSpecification[] {
  if (!state.roadwork) return []
  const lines: FilterSpecification = ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]]
  const width = (low: number, high: number): ExpressionSpecification => [
    'interpolate',
    ['linear'],
    ['zoom'],
    10,
    low,
    16,
    high,
  ]
  return [
    // A stretch of roadwork, where the source gives one: orange stripes on white, like a barrier.
    {
      id: 'closures-casing',
      type: 'line',
      source: CLOSURES_SOURCE,
      filter: lines,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': width(5, 11) },
    },
    {
      id: 'closures-line',
      type: 'line',
      source: CLOSURES_SOURCE,
      filter: lines,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': CONSTRUCTION_ORANGE, 'line-width': width(3, 7), 'line-dasharray': [1.5, 1] },
    },
    {
      id: 'closures-icon',
      type: 'symbol',
      source: CLOSURES_SOURCE,
      filter: ['==', ['geometry-type'], 'Point'],
      layout: {
        'icon-image': CLOSURE_IMAGE,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 15, 1.05],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ]
}

const PLACE_HIGHLIGHT_SOURCE = 'place-highlight'

/** Places picked out from the How far list: a yellow ring and their marker, however far out. */
function placeHighlightLayers(state: StyleState, theme: Theme): LayerSpecification[] {
  const highlight = state.placeHighlight
  if (!highlight) return []
  return [
    {
      id: 'place-highlight-ring',
      type: 'circle',
      source: PLACE_HIGHLIGHT_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 8, 14, 13, 17, 16],
        'circle-color': HIGHLIGHT_COLOR,
        'circle-stroke-color': theme.contrast,
        'circle-stroke-width': 1,
      },
    },
    {
      id: 'place-highlight-icon',
      type: 'symbol',
      source: PLACE_HIGHLIGHT_SOURCE,
      layout: {
        'icon-image': placeImageId(highlight.kind),
        'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.85, 17, 1.1],
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
      },
    },
  ]
}

/** A place marker's size, growing with the zoom. */
const PLACE_ICON_SIZE: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 0.85, 17, 1.1]

/**
 * Zoomed out, the places of each group picked are merged where they would
 * overlap, groups apart: a circle in the group's colour, as big as how many
 * it holds, with the number; the ones left alone keep their marker. A click zooms in.
 */
function mergedPlacesLayers(state: StyleState): LayerSpecification[] {
  const kind = state.placeHighlight?.kind
  const rest: ExpressionSpecification | number = kind ? ['case', ['==', ['get', 'kind'], kind], 1, 0.3] : 1
  const merged: FilterSpecification = ['has', 'point_count']
  return pickedGroups(state).flatMap((group): LayerSpecification[] => {
    const id = mergedPlacesId(group)
    return [
      {
        id,
        type: 'circle',
        source: id,
        maxzoom: PLACES_UNMERGED_FROM,
        filter: merged,
        // Bigger ones first, so smaller ones are drawn over them.
        layout: { 'circle-sort-key': ['-', ['get', 'point_count']] },
        paint: {
          'circle-color': GROUP_COLORS[group],
          'circle-radius': ['min', 22, ['+', 9, ['*', 1.1, ['sqrt', ['get', 'point_count']]]]],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
        },
      },
      {
        id: `${id}-count`,
        type: 'symbol',
        source: id,
        maxzoom: PLACES_UNMERGED_FROM,
        filter: merged,
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': ['Noto Sans Medium'],
          'text-size': 11,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: { 'text-color': '#ffffff' },
      },
      {
        id: `${id}-alone`,
        type: 'symbol',
        source: id,
        maxzoom: PLACES_UNMERGED_FROM,
        filter: ['!', merged],
        layout: {
          'icon-image': ['concat', placeImageId(''), ['get', 'kind']],
          'icon-size': PLACE_ICON_SIZE,
          'icon-allow-overlap': true,
        },
        paint: { 'icon-opacity': rest },
      },
    ]
  })
}

function placesLayer(state: StyleState, theme: Theme): LayerSpecification {
  // With a kind picked out, the others step back.
  const kind = state.placeHighlight?.kind
  const rest: ExpressionSpecification | number = kind ? ['case', ['==', ['get', 'kind'], kind], 1, 0.3] : 1
  return {
    id: 'places-icon',
    type: 'symbol',
    source: PLACES_SOURCE,
    'source-layer': 'places',
    // Further out, the merged places stand in.
    minzoom: PLACES_MERGED_UNTIL + 1,
    filter: ['in', ['get', 'kind'], ['literal', [...state.placeKinds]]],
    layout: {
      // Drawn on demand by the map view, one image per kind.
      'icon-image': ['concat', placeImageId(''), ['get', 'kind']],
      'icon-size': PLACE_ICON_SIZE,
      // Every marker shows, and names steer clear of them.
      'icon-allow-overlap': true,
      // Names never push a marker off the map; where they would collide they are left out.
      'text-field': ['step', ['zoom'], '', PLACE_LABEL_ZOOM, ['coalesce', ['get', 'name'], '']],
      'text-optional': true,
      'text-font': ['Noto Sans Medium'],
      'text-size': 12,
      'text-max-width': 8,
      'text-variable-anchor': ['top', 'bottom', 'left', 'right'],
      'text-radial-offset': 1.25,
      'text-justify': 'auto',
    },
    paint: {
      'text-color': theme.contrast,
      'text-halo-color': theme.halo,
      'text-halo-width': 1.5,
      'icon-opacity': rest,
      'text-opacity': rest,
    },
  }
}

/**
 * The whole map style as a function of app state. MapLibre diffs successive
 * styles, so switching layer, language or selection only touches what changed.
 */
export function buildStyle(state: StyleState, assetsBase: string): StyleSpecification {
  const collisions = collisionLayers(state)
  const thefts = theftLayers(state)
  const construction = constructionLayers(state)
  const theme = state.lights && state.basemap === 'dark' ? NIGHT_THEME : THEMES[state.basemap]
  const wards = wardLayers(state, theme)
  const lights = lightLayers(state, theme)
  const drawn = basemapLayers('basemap', theme.flavor, { lang: state.lang, labelsOnly: theme.imagery })
  const base: LayerSpecification[] = theme.imagery
    ? [{ id: 'imagery', type: 'raster', source: 'imagery' }, ...drawn]
    : drawn
  // Data goes under the basemap's labels so street names stay readable.
  const firstLabel = base.findIndex((l) => l.type === 'symbol')
  const at = firstLabel === -1 ? base.length : firstLabel
  return {
    version: 8,
    glyphs: `${assetsBase}/basemap-assets/fonts/{fontstack}/{range}.pbf`,
    sprite: `${assetsBase}/basemap-assets/sprites/v4/${theme.sprite}`,
    sources: {
      basemap: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/basemap.pmtiles`, attribution: ATTRIBUTION },
      ...(theme.imagery && {
        imagery: {
          type: 'raster',
          tiles: [IMAGERY_TILES],
          tileSize: 256,
          maxzoom: 19,
          attribution: IMAGERY_ATTRIBUTION,
        },
      }),
      ...((showsWays(state) || state.bikeLanes) && {
        [WAYS_SOURCE]: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/overlays.pmtiles` },
      }),
      ...(state.bikeRoutes && {
        [ROUTES_SOURCE]: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/routes.pmtiles` },
      }),
      // A small file, fetched by the map from its URL once the overlay is turned on.
      ...(state.wards && {
        [WARDS_SOURCE]: { type: 'geojson', data: `${assetsBase}/data/wards.geojson`, attribution: WARDS_ATTRIBUTION },
      }),
      ...(loadsPlaces(state) && {
        [PLACES_SOURCE]: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/places.pmtiles` },
      }),
      ...(showsPlaces(state) &&
        Object.fromEntries(
          pickedGroups(state).map((group) => [
            mergedPlacesId(group),
            {
              type: 'geojson',
              data: state.placePoints?.[group] ?? { type: 'FeatureCollection', features: [] },
              cluster: true,
              clusterRadius: PLACES_MERGE_RADIUS,
              clusterMaxZoom: PLACES_MERGED_UNTIL,
            },
          ]),
        )),
      // Loaded only while the street lights overlay is on.
      ...(lights.under.length && {
        night: { type: 'vector', url: `pmtiles://${assetsBase}/tiles/night.pmtiles` },
      }),
      route: {
        type: 'geojson',
        data: routeData(state.route, state.routeView ?? 'comfort'),
        ...(state.route && { attribution: ELEVATION_ATTRIBUTION }),
      },
      'route-stops': { type: 'geojson', data: stopsData(state.route) },
      'route-others': { type: 'geojson', data: otherRoutesData(state.routeOthers) },
      ...(state.placeHighlight && {
        [PLACE_HIGHLIGHT_SOURCE]: {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: state.placeHighlight.points.map((coordinates) => ({
              type: 'Feature',
              properties: {},
              geometry: { type: 'Point', coordinates: [...coordinates] },
            })),
          },
        },
      }),
      ...(state.reach && { [REACH_SOURCE]: { type: 'geojson', data: { type: 'FeatureCollection', features: [] } } }),
      // Loaded only while the collisions layer is on.
      ...(collisions.over.length && {
        [COLLISIONS_SOURCE]: {
          type: 'geojson',
          data: state.collisions ?? { type: 'FeatureCollection', features: [] },
          attribution: COLLISIONS_ATTRIBUTION,
        },
        [COLLISION_SPOTS_SOURCE]: {
          type: 'geojson',
          data: state.collisions ?? { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: MERGE_RADIUS,
          clusterMaxZoom: MERGED_UNTIL,
          clusterProperties: mergedProperties({ worst: ['max', ['get', 'worst']] }),
        },
      }),
      // Fetched by the map from its URL while the projects layer is on.
      ...(construction.under.length && {
        [CONSTRUCTION_SOURCE]: {
          type: 'geojson',
          data: `${assetsBase}/tiles/construction.geojson`,
          attribution: CONSTRUCTION_ATTRIBUTION,
        },
      }),
      // The closures, fetched live while the roadwork overlay is on.
      ...(state.roadwork && {
        [CLOSURES_SOURCE]: {
          type: 'geojson',
          data: state.closures ?? { type: 'FeatureCollection', features: [] },
          attribution: CLOSURES_ATTRIBUTION,
        },
      }),
      // Loaded only while the thefts layer is on.
      ...(thefts.over.length && {
        [THEFTS_SOURCE]: {
          type: 'geojson',
          data: state.thefts ?? { type: 'FeatureCollection', features: [] },
          attribution: THEFTS_ATTRIBUTION,
        },
        [THEFT_SPOTS_SOURCE]: {
          type: 'geojson',
          data: state.thefts ?? { type: 'FeatureCollection', features: [] },
          cluster: true,
          clusterRadius: MERGE_RADIUS,
          clusterMaxZoom: MERGED_UNTIL,
          clusterProperties: mergedProperties({
            value: ['+', ['get', 'value']],
            valued: ['+', ['get', 'valued']],
          }),
        },
      }),
    },
    layers: [
      ...base.slice(0, at),
      ...lights.under,
      ...routeBandLayers(state),
      ...bikeLaneLayers(state),
      ...overlayLayers(state, theme),
      ...wards.lines,
      ...lights.over,
      ...reachLayers(state.reach, state.basemap),
      ...collisions.under,
      ...thefts.under,
      ...construction.under,
      ...routeLayers(
        theme,
        state.routeHighlight,
        state.routeOnFoot ?? false,
        state.routeOthersDim ?? false,
        state.routeStops ?? true,
      ),
      ...base.slice(at),
      ...reachLabelLayers(state.reach, state.basemap, theme),
      ...routeLabelLayers(state, theme),
      ...wards.labels,
      ...(showsPlaces(state) ? [...mergedPlacesLayers(state), placesLayer(state, theme)] : []),
      ...placeHighlightLayers(state, theme),
      ...collisions.over,
      ...thefts.over,
      ...construction.over,
      ...roadworkLayers(state),
      ...routeBubbleLayers(state.routeHighlight),
      ...otherRouteLabelLayers(state.routeOthersDim ?? false),
    ],
  }
}
