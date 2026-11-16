// The comfort layer's filters: each way's speed limit, lanes, bike infrastructure
// and surface sorted into a few bands, written into the tiles for the map to
// filter by, and added up in km for the legend's bars.

import { surfaceGroup } from './classify.mjs'

const number = (text) => {
  const n = Number.parseFloat(String(text ?? ''))
  return Number.isFinite(n) ? n : null
}

/** Speed limit, km/h: up to 30, 40, 50, 60, or 70 and up; unknown when not tagged. Paths have none. */
export function speedBand(props) {
  if (props.kind === 'path') return undefined
  const speed = number(props.maxspeed)
  if (speed === null) return 'unknown'
  if (speed <= 30) return '30'
  if (speed <= 40) return '40'
  if (speed <= 50) return '50'
  if (speed <= 60) return '60'
  return '70'
}

/** Lanes in all: one or two (a lane each way, or less), three or more; unknown when not tagged. Paths have none. */
export function laneBand(props) {
  if (props.kind === 'path') return undefined
  const lanes = number(props.lanes)
  if (lanes === null) return 'unknown'
  return lanes <= 2 ? 'few' : 'many'
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

/** The bands of a way on the comfort layer, as tile properties. */
export function comfortBands(props) {
  const bands = {
    speed_band: speedBand(props),
    lane_band: laneBand(props),
    bike_band: bikeBand(props),
    surface_band: surfaceBand(props),
  }
  for (const key of Object.keys(bands)) if (bands[key] === undefined) delete bands[key]
  return bands
}

/** The sets the legend filters by, in the order of each total's key. */
export const COMFORT_SETS = ['stress', 'speed', 'lanes', 'bikeway', 'surface']

/**
 * Km of the comfort layer for each combination of bands: few enough rows (a
 * few hundred) for the legend to count any choice of filters from. A path's
 * speed and lanes are `-`.
 */
export function comfortTotals() {
  const metres = new Map()
  return {
    add(props, length) {
      if (!(props.lts > 0)) return
      const key = [
        props.lts,
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
