/** The switchable data layers and their colours. Shared by the map style and the legend. */

import { type KnownSurfaceId, WIDTH_STOPS } from './pathways'

export const LAYER_IDS = [
  'places',
  'pathways',
  'comfort',
  'winter',
  'night',
  'collisions',
  'thefts',
  'construction',
] as const
export type LayerId = (typeof LAYER_IDS)[number]

export const BASEMAP_IDS = ['light', 'grey', 'dark', 'satellite'] as const
export type BasemapId = (typeof BASEMAP_IDS)[number]

export const INK = '#16242B'

/** Level of traffic stress 1 to 4. */
export const LTS_COLORS = ['#1B5FAE', '#62B0E8', '#F2A33A', '#B5341F'] as const

/** Where cycling is not permitted, e.g. a sidewalk on a route. */
export const NO_BIKES_COLOR = '#8A949A'

/** Street light, for the night layer: soft warm white (LED) on dark ground, a deeper amber where the ground is pale. */
export const LAMP_COLOR = '#FFF0D2'
export const LAMP_COLOR_ON_PALE = '#D9730D'

export function lampColor(basemap: BasemapId): string {
  return basemap === 'light' || basemap === 'grey' ? LAMP_COLOR_ON_PALE : LAMP_COLOR
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
 * The pathways layer. Surfaces run from green (paved) to brown (dirt); widths
 * through one green, strongest where widest: darkest on pale ground, brightest
 * on dark. A surface or width not yet tagged is yellow, outside both ranges.
 */
interface PathwayColors {
  surface: Record<KnownSurfaceId, string>
  /** At each of WIDTH_STOPS. */
  width: readonly string[]
  unknown: string
}
const PATHWAYS_ON_PALE: PathwayColors = {
  surface: { paved: '#1E7B34', stone_dust: '#6E9A3E', gravel: '#9C7650', dirt: '#5E3A1E' },
  width: ['#A3D39A', '#5DAE5E', '#2A8540', '#0D5A26'],
  unknown: '#F5C000',
}
const PATHWAYS_ON_DARK: PathwayColors = {
  surface: { paved: '#6FD27F', stone_dust: '#A3C77A', gravel: '#C99B6E', dirt: '#A0683F' },
  width: ['#346B3D', '#4C9C58', '#7ACB83', '#C2F2BC'],
  unknown: '#FFD60A',
}

export function pathwayColors(basemap: BasemapId): PathwayColors {
  return basemap === 'light' || basemap === 'grey' ? PATHWAYS_ON_PALE : PATHWAYS_ON_DARK
}

/** The width colours as a CSS gradient from no width to the widest stop. */
export function widthGradient(basemap: BasemapId): string {
  const { width } = pathwayColors(basemap)
  const last = WIDTH_STOPS[WIDTH_STOPS.length - 1]
  const stops = WIDTH_STOPS.map((metres, i) => `${width[i]} ${(metres / last) * 100}%`)
  return `linear-gradient(to right, ${width[0]} 0%, ${stops.join(', ')})`
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

export function isBasemapId(value: unknown): value is BasemapId {
  return BASEMAP_IDS.includes(value as BasemapId)
}

export function isLayerId(value: unknown): value is LayerId {
  return LAYER_IDS.includes(value as LayerId)
}
