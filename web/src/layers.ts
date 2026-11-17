/** The switchable data layers and their colours. Shared by the map style and the legend. */

import type { ComfortSet } from './comfort'
import type { KnownSurfaceId, PathwaySet, WidthBand } from './pathways'

export const LAYER_IDS = ['places', 'pathways', 'comfort', 'collisions', 'thefts', 'construction'] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const BASEMAP_IDS = ['light', 'grey', 'dark', 'satellite'] as const
export type BasemapId = (typeof BASEMAP_IDS)[number]

export const INK = '#16242B'

/** Categorical hues in a fixed order (validated light-mode set); other is a neutral grey. */
export const HUES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
export const OTHER = '#9AA1A6'

/** Seasons take the hue that suits them: winter blue, spring green, summer amber, fall orange. */
export const SEASON_HUES: Record<string, string> = { winter: HUES[0], spring: HUES[2], summer: HUES[3], fall: HUES[1] }

/** Level of traffic stress 1 to 4. */
export const LTS_COLORS = ['#1B5FAE', '#62B0E8', '#F2A33A', '#B5341F'] as const

/** Where cycling is not permitted, e.g. a sidewalk on a route. */
export const NO_BIKES_COLOR = '#8A949A'

/** Lit, as data (the route card, the lighting filters): a golden yellow on pale ground. */
export const LAMP_COLOR_ON_PALE = '#E2A400'

/**
 * The street lights overlay: soft warm white (LED) on dark ground; on pale
 * ground a light yellow, soft enough to sit under the data layers and apart
 * from the comfort layer's amber.
 */
export const LAMP_COLOR = '#FFF0D2'
export const STREET_LIGHT_ON_PALE = '#E6A800'

export function lampColor(basemap: BasemapId): string {
  return basemap === 'light' || basemap === 'grey' ? STREET_LIGHT_ON_PALE : LAMP_COLOR
}

/**
 * How far you get: minutes of riding, closest first. One petrol blue, strongest
 * where it is closest, so it fades out against pale ground and lights up on dark.
 */
export const REACH_RAMP_ON_PALE = ['#0A4A6E', '#106A96', '#2389BD', '#5FAAD3', '#9DCBE6'] as const
export const REACH_RAMP_ON_DARK = ['#D2ECF7', '#A3D4EC', '#6CB8DE', '#3796C6', '#1D76A3'] as const

export function reachRamp(basemap: BasemapId): readonly string[] {
  return basemap === 'light' || basemap === 'grey' ? REACH_RAMP_ON_PALE : REACH_RAMP_ON_DARK
}

/**
 * Collisions by worst injury, none to fatal. Damage only is grey; injuries run
 * through one red, the worst standing out most: darkest on pale ground,
 * brightest on dark ground. Size carries severity too.
 */
const COLLISIONS_ON_PALE = { none: '#9AA1A6', minimal: '#F29470', minor: '#E2603A', major: '#BC2F1F', fatal: '#741012' }
const COLLISIONS_ON_DARK = { none: '#6F777B', minimal: '#7A3B2E', minor: '#B5442C', major: '#EE6A45', fatal: '#FFB199' }

export function collisionColors(basemap: BasemapId): Record<'none' | 'minimal' | 'minor' | 'major' | 'fatal', string> {
  return basemap === 'light' || basemap === 'grey' ? COLLISIONS_ON_PALE : COLLISIONS_ON_DARK
}

/**
 * Bike thefts: one purple, apart from the collisions' reds. Intersections step
 * through it by the value stolen there (a step per VALUE_STEPS band), the most
 * darkest on pale ground and brightest on dark; grey where no value was given.
 * The heat map's strongest steps go the same way.
 */
interface TheftColors {
  spot: string
  values: readonly string[]
  noValue: string
  heat: readonly string[]
}
const THEFTS_ON_PALE: TheftColors = {
  spot: '#7A3E9D',
  values: ['#D7C2EA', '#B48AD6', '#8F5BBF', '#6A3496', '#43165F'],
  noValue: '#9AA1A6',
  heat: ['rgba(167, 120, 205, 0.4)', '#A16BC9', '#7A3E9D', '#4E1F6B'],
}
const THEFTS_ON_DARK: TheftColors = {
  spot: '#C9A2EA',
  values: ['#5B3A7A', '#7B52A8', '#9A6CC8', '#C6A0EC', '#F0DEFF'],
  noValue: '#6F777B',
  heat: ['rgba(98, 58, 130, 0.5)', '#8A5BB5', '#B98DE3', '#EAD8FB'],
}

export function theftColors(basemap: BasemapId): TheftColors {
  return basemap === 'light' || basemap === 'grey' ? THEFTS_ON_PALE : THEFTS_ON_DARK
}

/**
 * Construction by when it happens, from work under way to work two to three
 * years out: one orange, strongest for now, darkest on pale ground and
 * brightest on dark.
 */
const CONSTRUCTION_ON_PALE = { now: '#B8330C', thisYear: '#E2611B', soon: '#EE9A2E', later: '#E3BD5E' }
const CONSTRUCTION_ON_DARK = { now: '#FF8A50', thisYear: '#F5A050', soon: '#D9A85E', later: '#A08C62' }

export function constructionColors(basemap: BasemapId): Record<'now' | 'thisYear' | 'soon' | 'later', string> {
  return basemap === 'light' || basemap === 'grey' ? CONSTRUCTION_ON_PALE : CONSTRUCTION_ON_DARK
}

/**
 * The bike lanes overlay: dedicated ways solid green, painted lanes a paler green
 * dashed, shared lanes that green dotted, paved shoulders yellow. The dedicated
 * green stands out most on any ground: darkest on pale maps, brightest on dark ones.
 */
export const BIKEWAY_IDS = ['dedicated', 'lane', 'shared', 'shoulder'] as const
export type BikewayId = (typeof BIKEWAY_IDS)[number]
const BIKEWAYS_ON_PALE: Record<BikewayId, string> = {
  dedicated: '#1E7B34',
  lane: '#3FA34D',
  shared: '#3FA34D',
  shoulder: '#E3AE00',
}
const BIKEWAYS_ON_DARK: Record<BikewayId, string> = {
  dedicated: '#7BE38A',
  lane: '#3FA557',
  shared: '#3FA557',
  shoulder: '#F2C94C',
}

export function bikewayColors(basemap: BasemapId): Record<BikewayId, string> {
  return basemap === 'light' || basemap === 'grey' ? BIKEWAYS_ON_PALE : BIKEWAYS_ON_DARK
}

/**
 * The bike routes overlay: signed routes by rank, and mountain-bike trails. One
 * palette on every map, for labels and swatches; the bands use routeBandColors.
 */
export const ROUTE_LEVEL_IDS = ['national', 'regional', 'local', 'mtb'] as const
export type RouteLevelId = (typeof ROUTE_LEVEL_IDS)[number]
export const ROUTE_COLORS: Record<RouteLevelId, string> = {
  national: '#C2255C',
  regional: '#E8590C',
  local: '#7950F2',
  mtb: '#B8652B',
}

/** Each map's ground, for the route bands to blend into. */
const GROUND: Record<BasemapId, string> = { light: '#E9ECE4', grey: '#E4E4E4', dark: '#2A2A2A', satellite: '#2A2A2A' }

function blend(color: string, ground: string, share: number): string {
  const rgb = (hex: string) => [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
  const [a, b] = [rgb(color), rgb(ground)]
  return `#${a
    .map((c, i) =>
      Math.round(c * share + b[i] * (1 - share))
        .toString(16)
        .padStart(2, '0'),
    )
    .join('')}`
}

/**
 * The route bands: the route colours blended into the map's ground, so they look
 * soft yet are solid. See-through bands darken wherever two of them overlap.
 */
export function routeBandColors(basemap: BasemapId): Record<RouteLevelId, string> {
  const share = basemap === 'satellite' ? 0.8 : 0.6
  return Object.fromEntries(
    ROUTE_LEVEL_IDS.map((id) => [id, blend(ROUTE_COLORS[id], GROUND[basemap], share)]),
  ) as Record<RouteLevelId, string>
}

export function isRouteLevelId(value: unknown): value is RouteLevelId {
  return ROUTE_LEVEL_IDS.includes(value as RouteLevelId)
}

export function isBikewayId(value: unknown): value is BikewayId {
  return BIKEWAY_IDS.includes(value as BikewayId)
}

/**
 * The pathways layer, coloured by surface: paved ones green, teal and blue,
 * unpaved ones olive to brown, other grey. A surface not yet tagged is yellow,
 * apart from them all. Neighbours in the list stay apart for colour-blind eyes.
 */
interface PathwayColors {
  surface: Record<KnownSurfaceId, string>
  unknown: string
}
const PATHWAYS_ON_PALE: PathwayColors = {
  surface: {
    asphalt: '#1E7B34',
    concrete: '#36AFA0',
    paving_stones: '#4F6FCF',
    fine_gravel: '#9AA845',
    gravel: '#A0703F',
    ground: '#4E2E14',
    other: '#9AA1A6',
  },
  unknown: '#F5C000',
}
const PATHWAYS_ON_DARK: PathwayColors = {
  surface: {
    asphalt: '#4FBF60',
    concrete: '#7DE6D8',
    paving_stones: '#9AA8FF',
    fine_gravel: '#A3B35A',
    gravel: '#EFC9A0',
    ground: '#A86A3C',
    other: '#B5BCC1',
  },
  unknown: '#FFD60A',
}

export function pathwayColors(basemap: BasemapId): PathwayColors {
  return basemap === 'light' || basemap === 'grey' ? PATHWAYS_ON_PALE : PATHWAYS_ON_DARK
}

/** Pathway widths, for the legend and the card: one green, the widest darkest. */
export const WIDTH_COLORS: Record<WidthBand, string> = {
  '0': '#A3D39A',
  '1.5': '#5DAE5E',
  '2.5': '#2A8540',
  '3.5': '#0D5A26',
}

/** Where lamps light a way: a deep amber on pale ground, a warm yellow on dark; unlit slate or grey. */
const LIT_ON_PALE = { yes: LAMP_COLOR_ON_PALE, no: '#34404A' }
const LIT_ON_DARK = { yes: '#FFC24A', no: '#6F7B80' }

/**
 * The pathways layer's colours for each set the map can be coloured by. Ordered
 * sets run through one hue, strongest for the best (widest, smoothest): darkest
 * on pale ground, brightest on dark. Not tagged is yellow, so the gaps show;
 * grey for lighting.
 */
export function pathwaySetColors(basemap: BasemapId): Record<PathwaySet, Record<string, string>> {
  const pale = basemap === 'light' || basemap === 'grey'
  const { surface, unknown } = pathwayColors(basemap)
  return {
    surface: { ...surface, unknown },
    // Cycle paths blue, paths green, footpaths purple: darker than the blue on pale
    // ground and lighter on dark, so colour-blind eyes tell the two apart.
    type: { cycleway: HUES[0], path: HUES[2], footway: pale ? '#7B3BA3' : '#C58AE0' },
    width: pale
      ? { ...WIDTH_COLORS, unknown }
      : { '0': '#346B3D', '1.5': '#4C9C58', '2.5': '#7ACB83', '3.5': '#C2F2BC', unknown },
    snow: pale ? { yes: '#1B5FAE', no: '#E07B1A', unknown } : { yes: '#5FA3EE', no: '#F08A2C', unknown },
    smoothness: pale
      ? { excellent: '#4F3487', good: '#8065B4', intermediate: '#B09AD3', bad: '#D9CCEB', unknown }
      : { excellent: '#E2D6F5', good: '#B09AD3', intermediate: '#8065B4', bad: '#5B4391', unknown },
    // Lighting's gaps are grey: most are dark paths no one has tagged, not ones to map first.
    lit: { ...(pale ? LIT_ON_PALE : LIT_ON_DARK), unknown: OTHER },
  }
}

/**
 * Ward boundaries and names: plum for Ottawa, teal for Gatineau, colours used
 * for nothing else on the map, darker on pale ground and lighter on dark.
 */
export function wardColors(basemap: BasemapId): { ottawa: string; gatineau: string } {
  return basemap === 'light' || basemap === 'grey'
    ? { ottawa: '#7A3B8F', gatineau: '#00838F' }
    : { ottawa: '#D6A6EC', gatineau: '#6ED3D8' }
}

export const WINTER_COLORS = { yes: '#1B5FAE', no: '#E07B1A', unknown: '#6F7B80' } as const

/** Bike infrastructure ridden, on the route card and the comfort layer: green to orange, from apart from cars to among them; shoulders, often beside fast traffic, in a sand of their own. */
export const BIKEWAY_PART_COLORS = { lane: '#F2C200', shoulder: '#BFA05A', traffic: '#E8701A' } as const

/** Speed limits are ordered: yellow to dark red, the slowest lightest but still plain on the map. */
const SPEED_STEPS = ['#FDD049', '#FDA33A', '#F2712B', '#D6422A', '#9E1B1B']

/** Road classes, minor to major: one blue from light to dark. */
const ROAD_STEPS = ['#9DC3E6', '#74A9D8', '#4F8FCB', '#3274B5', '#1F5A9A', '#16427A', '#0C2A52']

/** Lanes each way, ordered too: one blue, a single lane lightest. */
const LANE_STEPS = ['#8EC1EA', '#3E7FC4', '#163E7A']

/** Where a set does not apply (a path's lanes), pale and out of the way. */
export const NOT_APPLICABLE = '#D5D9DC'

/**
 * The comfort layer's colours for each set the map can be coloured by. Ordered
 * sets run light to dark, their lightest still plain on the map; in the
 * others, the usual case (riding with cars, paved) is a quiet grey or slate so
 * the rest stand out. The same on every map style, as the stress colours are.
 */
export function comfortSetColors(): Record<ComfortSet, Record<string, string>> {
  return {
    stress: { '1': LTS_COLORS[0], '2': LTS_COLORS[1], '3': LTS_COLORS[2], '4': LTS_COLORS[3] },
    // Pathways green and tracks brown, apart from the roads' blues.
    type: {
      path: '#1E7B34',
      residential: ROAD_STEPS[0],
      service: ROAD_STEPS[1],
      minor: ROAD_STEPS[2],
      tertiary: ROAD_STEPS[3],
      secondary: ROAD_STEPS[4],
      primary: ROAD_STEPS[5],
      trunk: ROAD_STEPS[6],
      track: '#B39264',
      other: OTHER,
    },
    speed: {
      '30': SPEED_STEPS[0],
      '40': SPEED_STEPS[1],
      '50': SPEED_STEPS[2],
      '60': SPEED_STEPS[3],
      '70': SPEED_STEPS[4],
      unknown: OTHER,
    },
    lanes: { '1': LANE_STEPS[0], '2': LANE_STEPS[1], '3': LANE_STEPS[2], unknown: OTHER },
    bikeway: { path: '#1E7B34', lane: '#F2C200', shoulder: '#C08A2E', shared: '#7B3BA3', none: '#B4BCC1' },
    surface: { paved: '#56656F', unpaved: '#C47F35', unknown: OTHER },
    lit: { ...LIT_ON_PALE, unknown: OTHER },
  }
}

/** Projects by kind of work, in the categorical hues: cycling green, roads orange, water blue, bridges amber, transit pink. */
export const CONSTRUCTION_KIND_COLORS: Record<string, string> = {
  cycling: HUES[2],
  roads: HUES[1],
  water: HUES[0],
  bridges: HUES[3],
  transit: HUES[4],
  other: OTHER,
}

export function isBasemapId(value: unknown): value is BasemapId {
  return BASEMAP_IDS.includes(value as BasemapId)
}

export function isLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.includes(value as LayerId)
}
