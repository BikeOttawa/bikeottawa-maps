import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  lengthBand,
  pathTypeBand,
  pathwayBands,
  pathwaySurface,
  pathwayTotals,
  smoothBand,
  widthBand,
} from './pathway-bands.mjs'

test('sorts surfaces into OSM types, the rest as other', () => {
  assert.equal(pathwaySurface('asphalt'), 'asphalt')
  assert.equal(pathwaySurface('concrete:plates'), 'concrete')
  assert.equal(pathwaySurface('sett'), 'paving_stones')
  assert.equal(pathwaySurface('compacted'), 'fine_gravel')
  assert.equal(pathwaySurface('dirt'), 'ground')
  assert.equal(pathwaySurface('unpaved'), 'ground')
  assert.equal(pathwaySurface('wood'), 'other')
  assert.equal(pathwaySurface('paved'), 'other')
  assert.equal(pathwaySurface(undefined), undefined)
})

test('bands pathways by type, width and smoothness', () => {
  assert.equal(pathTypeBand({ highway: 'cycleway' }), 'cycleway')
  assert.equal(pathTypeBand({ highway: 'path' }), 'path')
  assert.equal(pathTypeBand({ highway: 'footway', footway: 'sidewalk' }), 'footway')
  assert.equal(widthBand({ width_m: 1 }), '0')
  assert.equal(widthBand({ width_m: 1.5 }), '1.5')
  assert.equal(widthBand({ width_m: 3 }), '2.5')
  assert.equal(widthBand({ width_m: 4 }), '3.5')
  assert.equal(widthBand({}), 'unknown')
  assert.equal(smoothBand({ smoothness: 'good' }), 'good')
  assert.equal(smoothBand({ smoothness: 'very_bad' }), 'bad')
  assert.equal(smoothBand({}), 'unknown')
  assert.deepEqual(pathwayBands({ highway: 'cycleway', width_m: 3 }), {
    path_type: 'cycleway',
    width_band: '2.5',
    smooth_band: 'unknown',
  })
})

test("puts an island's length on the slider's step below it", () => {
  assert.equal(lengthBand(0), 0)
  assert.equal(lengthBand(299), 200)
  assert.equal(lengthBand(300), 300)
  assert.equal(lengthBand(25000), 10000)
})

test('adds up km by every combination of bands and length', () => {
  const totals = pathwayTotals()
  const path = {
    ...pathwayBands({ highway: 'path', width_m: 2 }),
    surface_group: 'asphalt',
    winter: 'yes',
    lit_band: 'yes',
    island_m: 750,
  }
  totals.add(path, 1200)
  totals.add({ ...pathwayBands({ highway: 'cycleway' }), island_m: 50 }, 300)
  assert.deepEqual(totals.toJSON(), {
    sets: ['type', 'surface', 'width', 'snow', 'smoothness', 'lit', 'length'],
    rows: [
      ['path', 'asphalt', '1.5', 'yes', 'unknown', 'yes', '500', 1.2],
      ['cycleway', 'unknown', 'unknown', 'unknown', 'unknown', 'unknown', '0', 0.3],
    ],
  })
})
