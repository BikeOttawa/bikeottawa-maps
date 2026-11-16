// The comfort layer's filters: each way's speed limit, lanes, bike infrastructure
// and surface sorted into a few bands, written into the tiles for the map to
// filter by, and added up in km for the legend's bars.

import { surfaceGroup } from './classify.mjs'

const number = (text) => {
  const n = Number.parseFloat(String(text ?? ''))
  return Number.isFinite(n) ? n : null
}

/** Speed limit, km/h: up to 30, 40, 50, 60, or 70 and up; unknown when not tagged. A path, with no cars, is up to 30. */
export function speedBand(props) {
  if (props.kind === 'path') return '30'
  const speed = number(props.maxspeed)
  if (speed === null) return 'unknown'
  if (speed <= 30) return '30'
  if (speed <= 40) return '40'
  if (speed <= 50) return '50'
  if (speed <= 60) return '60'
  return '70'
}

const ONE_WAY = new Set(['yes', 'true', '1', '-1'])

/**
 * Lanes each way: 1, 2, or 3 and up; unknown when not tagged. Per-direction
 * tags (lanes:forward, lanes:backward) say so outright: the busier way counts.
 * Otherwise a one-way street's lanes all go one way, and a two-way street's
 * are split, rounded up (3 lanes in all is 2 one way). Paths have none.
 */
export function laneBand(props, tags = {}) {
  if (props.kind === 'path') return undefined
  const forward = number(tags['lanes:forward'])
  const backward = number(tags['lanes:backward'])
  let each
  if (forward !== null || backward !== null) {
    each = Math.max(forward ?? 0, backward ?? 0)
  } else {
    const lanes = number(props.lanes ?? tags.lanes)
    if (lanes === null) return 'unknown'
    const oneWay = ONE_WAY.has(tags.oneway) || tags.junction === 'roundabout'
    each = oneWay ? lanes : Math.ceil(lanes / 2)
  }
  return each <= 1 ? '1' : each === 2 ? '2' : '3'
}

/** Road classes as the legend groups them, a road's links with it. */
const TYPE_OF = {
  cycleway: 'path',
  path: 'path',
  footway: 'path',
  bridleway: 'path',
  pedestrian: 'path',
  residential: 'residential',
  living_street: 'residential',
  service: 'service',
  unclassified: 'minor',
  tertiary: 'tertiary',
  tertiary_link: 'tertiary',
  secondary: 'secondary',
  secondary_link: 'secondary',
  primary: 'primary',
  primary_link: 'primary',
  trunk: 'trunk',
  trunk_link: 'trunk',
  track: 'track',
}

/** The kind of way: a pathway, a residential street, a service road… up to a primary road or a trunk; other for the rest. */
export function typeBand(props) {
  return TYPE_OF[props.highway] ?? (props.kind === 'path' ? 'path' : 'other')
}

const STREET_BIKEWAYS = { dedicated: 'path', lane: 'lane', shoulder: 'shoulder', shared: 'shared' }

/** A pathway or cycle track, a painted lane, a paved shoulder, a shared lane, or none: riding with cars. */
export function bikeBand(props) {
  if (props.kind === 'path') return 'path'
  return STREET_BIKEWAYS[props.bikeway] ?? 'none'
}

/** Paved, or not (stone dust, gravel, dirt). A street without a surface tag is taken to be paved, a path is unknown. */
export function surfaceBand(props) {
  const group = surfaceGroup(props.surface)
  if (group) return group === 'paved' ? 'paved' : 'unpaved'
  return props.kind === 'street' ? 'paved' : 'unknown'
}

/** The bands of a way on the comfort layer, as tile properties; the OSM tags tell which way it runs. */
export function comfortBands(props, tags = {}) {
  const bands = {
    type_band: typeBand(props),
    speed_band: speedBand(props),
    lane_band: laneBand(props, tags),
    bike_band: bikeBand(props),
    surface_band: surfaceBand(props),
  }
  for (const key of Object.keys(bands)) if (bands[key] === undefined) delete bands[key]
  return bands
}

/** The sets the legend filters by, in the order of each total's key. */
export const COMFORT_SETS = ['stress', 'type', 'speed', 'lanes', 'bikeway', 'surface']

/**
 * Km of the comfort layer for each combination of bands: few enough rows (a
 * few hundred) for the legend to count any choice of filters from. A path's
 * lanes are `-`.
 */
export function comfortTotals() {
  const metres = new Map()
  return {
    add(props, length) {
      if (!(props.lts > 0)) return
      const key = [
        props.lts,
        props.type_band,
        props.speed_band ?? '-',
        props.lane_band ?? '-',
        props.bike_band,
        props.surface_band,
      ].join('|')
      metres.set(key, (metres.get(key) ?? 0) + length)
    },
    toJSON() {
      const rows = [...metres]
        .map(([key, m]) => [...key.split('|'), Math.round(m / 100) / 10])
        .filter((row) => row.at(-1) > 0)
      return { sets: COMFORT_SETS, rows }
    },
  }
}
