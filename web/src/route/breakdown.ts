import surfaceGroups from '../../../pipeline/surface-groups.json'
import type { MessageKey } from '../i18n'
import { bikewayColors, LAMP_COLOR_ON_PALE, LTS_COLORS, NO_BIKES_COLOR, pathwayColors, WINTER_COLORS } from '../layers'
import { COMFORT_KEYS, comfortKeyOf, type Route, type RouteSegment } from './brouter'

/**
 * What the route summary splits a route by: comfort, the bike infrastructure
 * ridden, surface, lighting and winter maintenance. Each stretch of the route
 * belongs to one part of each, from the tags BRouter returns for it.
 */
export const ROUTE_VIEWS = ['comfort', 'bikeway', 'surface', 'lit', 'winter'] as const
export type RouteView = (typeof ROUTE_VIEWS)[number]

export function isRouteView(value: unknown): value is RouteView {
  return ROUTE_VIEWS.includes(value as RouteView)
}

/** The parts of each view, in the order they are listed. */
export const ROUTE_PARTS: Record<RouteView, readonly string[]> = {
  comfort: COMFORT_KEYS,
  bikeway: ['path', 'lane', 'shoulder', 'traffic', 'walk'],
  surface: ['paved', 'stone_dust', 'gravel', 'dirt', 'unknown'],
  lit: ['yes', 'no', 'unknown'],
  winter: ['yes', 'no', 'unknown'],
}

/** Off-street ways: everything else is a street, with traffic on it. */
const PATH_HIGHWAYS = new Set(['cycleway', 'path', 'footway', 'bridleway', 'pedestrian', 'track', 'steps'])

/** Sidewalks and crossings go with their street: paved, and plowed with it. */
const alongStreet = (tags: Record<string, string>) =>
  !PATH_HIGHWAYS.has(tags.highway) || tags.footway === 'sidewalk' || tags.footway === 'crossing'

const SURFACE_GROUP_OF = new Map(
  Object.entries(surfaceGroups).flatMap(([group, values]) => values.map((value) => [value, group])),
)

/** Paved, stone dust, gravel or dirt, as on the pathways layer. A street without a surface tag is taken to be paved. */
function surfacePart(tags: Record<string, string>): string {
  const group = tags.surface && SURFACE_GROUP_OF.get(tags.surface.split(';')[0].trim())
  return group ?? (alongStreet(tags) ? 'paved' : 'unknown')
}

const LIT = new Set(['yes', '24/7', 'automatic', 'sunset-sunrise', 'limited', 'interval'])

function litPart(tags: Record<string, string>): string {
  if (!tags.lit) return 'unknown'
  return LIT.has(tags.lit) ? 'yes' : tags.lit === 'no' ? 'no' : 'unknown'
}

/**
 * As tagged; otherwise paved streets and their sidewalks are plowed, unpaved
 * ones unknown, and paths as the Winter layer has them: unpaved not plowed.
 */
function winterPart(tags: Record<string, string>): string {
  const service = tags.winter_service
  if (service === 'yes' || service === 'no') return service
  const paved = surfacePart(tags) === 'paved'
  if (alongStreet(tags)) return paved ? 'yes' : 'unknown'
  return paved || surfacePart(tags) === 'unknown' ? 'unknown' : 'no'
}

/** Best first. */
const BIKEWAY_RANK = ['path', 'lane', 'shoulder', 'traffic']
const STREET_BIKEWAYS: Record<string, string> = {
  track: 'path',
  opposite_track: 'path',
  lane: 'lane',
  opposite_lane: 'lane',
  shoulder: 'shoulder',
}
const ONEWAY = new Set(['yes', 'true', '1', '-1'])

/**
 * The bike infrastructure on the side of the street being ridden: the right
 * side of the way, or its left when ridden against the way's direction. On a
 * one-way street, a lane on either side with the traffic, or a contraflow
 * (`opposite_*`) one against it.
 */
function streetBikeway(tags: Record<string, string>, reversed: boolean): string {
  const values = (keys: string[]) => keys.map((key) => tags[key]).filter((value) => value !== undefined)
  let found: string[]
  if (ONEWAY.has(tags.oneway)) {
    const withTraffic = tags.oneway === '-1' ? reversed : !reversed
    const all = values(['cycleway', 'cycleway:both', 'cycleway:left', 'cycleway:right'])
    found = all.filter((value) => value.startsWith('opposite') !== withTraffic)
  } else {
    const side = values([reversed ? 'cycleway:left' : 'cycleway:right', 'cycleway:both'])
    found = side.length ? side : values(['cycleway'])
  }
  const kinds = found.map((value) => STREET_BIKEWAYS[value] ?? 'traffic')
  return BIKEWAY_RANK.find((kind) => kinds.includes(kind)) ?? 'traffic'
}

function bikewayPart(segment: Pick<RouteSegment, 'lts' | 'tags' | 'reversed'>): string {
  if (segment.lts === 0) return 'walk'
  if (!alongStreet(segment.tags) || segment.tags.footway === 'crossing') return 'path'
  return streetBikeway(segment.tags, segment.reversed)
}

/** Which part of a view a stretch of the route belongs to. */
export function partOf(segment: Pick<RouteSegment, 'lts' | 'walk' | 'tags' | 'reversed'>, view: RouteView): string {
  switch (view) {
    case 'comfort':
      return comfortKeyOf(segment)
    case 'bikeway':
      return bikewayPart(segment)
    case 'surface':
      return surfacePart(segment.tags)
    case 'lit':
      return litPart(segment.tags)
    case 'winter':
      return winterPart(segment.tags)
  }
}

/** Metres of the route in each part of a view. */
export function distanceByPart(route: Route, view: RouteView): Map<string, number> {
  const totals = new Map<string, number>()
  for (const segment of route.segments) {
    const part = partOf(segment, view)
    totals.set(part, (totals.get(part) ?? 0) + segment.distance)
  }
  return totals
}

interface PartLook {
  color: string
  label: MessageKey
  /** The swatch drawn as on the map's keys: dashed or dotted. */
  pattern?: 'dashed'
}

// The card is pale, so each view takes the colours its map layer uses on pale ground.
const bikeways = bikewayColors('light')
const pathways = pathwayColors('light')

const LOOKS: Record<RouteView, Record<string, PartLook>> = {
  comfort: {
    lts1: { color: LTS_COLORS[0], label: 'lts.1' },
    lts2: { color: LTS_COLORS[1], label: 'lts.2' },
    lts3: { color: LTS_COLORS[2], label: 'lts.3' },
    lts4: { color: LTS_COLORS[3], label: 'lts.4' },
    sidewalk: { color: NO_BIKES_COLOR, label: 'sidewalk' },
    stairs: { color: NO_BIKES_COLOR, label: 'stairs' },
    other: { color: NO_BIKES_COLOR, label: 'walk' },
  },
  bikeway: {
    path: { color: bikeways.dedicated, label: 'bikewayPart.path' },
    // Green to orange, from apart from cars to among them; shoulders, often
    // beside fast traffic, in a sand of their own.
    lane: { color: '#F2C200', label: 'bikeway.lane', pattern: 'dashed' },
    shoulder: { color: '#BFA05A', label: 'bikeway.shoulder' },
    traffic: { color: '#E8701A', label: 'bikewayPart.traffic' },
    walk: { color: NO_BIKES_COLOR, label: 'walk' },
  },
  surface: {
    // In the colours of the pathways layer's surfaces they stand for.
    paved: { color: pathways.surface.asphalt, label: 'surface.paved' },
    stone_dust: { color: pathways.surface.fine_gravel, label: 'surface.stone_dust' },
    gravel: { color: pathways.surface.gravel, label: 'surface.gravel' },
    dirt: { color: pathways.surface.ground, label: 'surface.dirt' },
    unknown: { color: pathways.unknown, label: 'surface.unknown' },
  },
  lit: {
    yes: { color: LAMP_COLOR_ON_PALE, label: 'litPart.yes' },
    no: { color: '#34404A', label: 'litPart.no' },
    unknown: { color: NO_BIKES_COLOR, label: 'unknown' },
  },
  winter: {
    yes: { color: WINTER_COLORS.yes, label: 'winter.yes' },
    no: { color: WINTER_COLORS.no, label: 'winter.no' },
    unknown: { color: WINTER_COLORS.unknown, label: 'winter.unknown' },
  },
}

export function partLook(view: RouteView, part: string): PartLook {
  return LOOKS[view][part] ?? { color: NO_BIKES_COLOR, label: 'unknown' }
}
