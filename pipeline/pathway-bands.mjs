// The pathways layer's filters: each pathway's surface, type, width and
// smoothness sorted into a few bands (its snow clearing it has already), written
// into the tiles for the map to filter by, and added up in km for the legend's
// bars, by the length of the island it is part of too.

import LENGTH_STEPS from './pathway-lengths.json' with { type: 'json' }

/** OSM's surface types, a few alike taken together; the rest are other. */
const SURFACES = {
  asphalt: ['asphalt', 'chipseal'],
  concrete: ['concrete', 'concrete:plates', 'concrete:lanes'],
  paving_stones: ['paving_stones', 'sett', 'bricks', 'brick', 'cobblestone', 'unhewn_cobblestone'],
  fine_gravel: ['fine_gravel', 'compacted', 'stone_dust'],
  gravel: ['gravel', 'pebblestone', 'crushed_stone'],
  ground: ['ground', 'dirt', 'earth', 'mud', 'unpaved', 'dirt/sand', 'clay'],
}
const SURFACE_OF = new Map(Object.entries(SURFACES).flatMap(([group, values]) => values.map((v) => [v, group])))

/** A pathway's surface: asphalt, concrete, paving stones, fine gravel, gravel, ground or other; undefined when not tagged. */
export function pathwaySurface(surface) {
  if (!surface) return undefined
  return SURFACE_OF.get(surface.split(';')[0].trim()) ?? 'other'
}

/** Cycleways, multi-use paths, and footways or sidewalks bikes may use. */
export function pathTypeBand(props) {
  if (props.highway === 'cycleway') return 'cycleway'
  if (props.highway === 'path') return 'path'
  return 'footway'
}

/** Width bands by their least width in metres: under 1.5, 1.5, 2.5, 3.5 and up; unknown when not tagged. */
export function widthBand(props) {
  const w = props.width_m
  if (!(w > 0)) return 'unknown'
  return w < 1.5 ? '0' : w < 2.5 ? '1.5' : w < 3.5 ? '2.5' : '3.5'
}

const ROUGH = new Set(['bad', 'very_bad', 'horrible', 'very_horrible', 'impassable'])

/** OSM smoothness: excellent, good, intermediate, or bad and worse; unknown when not tagged. */
export function smoothBand(props) {
  const value = props.smoothness
  if (value === 'excellent' || value === 'good' || value === 'intermediate') return value
  return ROUGH.has(value) ? 'bad' : 'unknown'
}

/** The island length step a pathway reaches: the slider's step at or below its island's length. */
export function lengthBand(islandMetres) {
  let band = 0
  for (const step of LENGTH_STEPS) if (islandMetres >= step) band = step
  return band
}

/** The bands of a pathway, as tile properties. */
export function pathwayBands(props) {
  return { path_type: pathTypeBand(props), width_band: widthBand(props), smooth_band: smoothBand(props) }
}

/** The sets the legend filters by, then the length band, in the order of each total's key. Lit is set by the transform. */
export const PATHWAY_SETS = ['type', 'surface', 'width', 'snow', 'smoothness', 'lit', 'length']

/** Km of pathway for each combination of bands and island length step. */
export function pathwayTotals() {
  const metres = new Map()
  return {
    add(props, length) {
      const key = [
        props.path_type,
        props.surface_group ?? 'unknown',
        props.width_band,
        props.winter ?? 'unknown',
        props.smooth_band,
        props.lit_band ?? 'unknown',
        lengthBand(props.island_m ?? 0),
      ].join('|')
      metres.set(key, (metres.get(key) ?? 0) + length)
    },
    toJSON() {
      const rows = [...metres]
        .map(([key, m]) => [...key.split('|'), Math.round(m / 100) / 10])
        .filter((row) => row.at(-1) > 0)
      return { sets: PATHWAY_SETS, rows }
    },
  }
}
