import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bikeBand, comfortBands, comfortTotals, laneBand, speedBand, surfaceBand, typeBand } from './comfort.mjs'

test('bands speed limits, untagged as unknown, paths as 30 or less', () => {
  assert.equal(speedBand({ kind: 'street', maxspeed: '30' }), '30')
  assert.equal(speedBand({ kind: 'street', maxspeed: '40 km/h' }), '40')
  assert.equal(speedBand({ kind: 'street', maxspeed: '50' }), '50')
  assert.equal(speedBand({ kind: 'street', maxspeed: '80' }), '70')
  assert.equal(speedBand({ kind: 'street' }), 'unknown')
  assert.equal(speedBand({ kind: 'street', maxspeed: 'CA:ON:urban' }), 'unknown')
  assert.equal(speedBand({ kind: 'path' }), '30')
})

test('bands lanes each way', () => {
  const street = { kind: 'street', lanes: '2' }
  // Two-way: split, rounded up.
  assert.equal(laneBand(street, {}), '1')
  assert.equal(laneBand({ kind: 'street', lanes: '3' }, {}), '2')
  assert.equal(laneBand({ kind: 'street', lanes: '4' }, {}), '2')
  assert.equal(laneBand({ kind: 'street', lanes: '6' }, {}), '3')
  // One-way: all one way.
  assert.equal(laneBand(street, { oneway: 'yes' }), '2')
  assert.equal(laneBand({ kind: 'street', lanes: '3' }, { oneway: '-1' }), '3')
  assert.equal(laneBand({ kind: 'street', lanes: '2' }, { junction: 'roundabout' }), '2')
  // Tagged each way: the busier way.
  assert.equal(laneBand({ kind: 'street', lanes: '3' }, { 'lanes:forward': '2', 'lanes:backward': '1' }), '2')
  assert.equal(laneBand({ kind: 'street' }, {}), 'unknown')
  assert.equal(laneBand({ kind: 'path' }, {}), undefined)
})

test('sorts ways into types, a road with its links', () => {
  assert.equal(typeBand({ kind: 'path', highway: 'cycleway' }), 'path')
  assert.equal(typeBand({ kind: 'street', highway: 'living_street' }), 'residential')
  assert.equal(typeBand({ kind: 'street', highway: 'unclassified' }), 'minor')
  assert.equal(typeBand({ kind: 'street', highway: 'secondary_link' }), 'secondary')
  assert.equal(typeBand({ kind: 'path', highway: 'track' }), 'track')
  assert.equal(typeBand({ kind: 'street', highway: 'busway' }), 'other')
})

test('sorts bike infrastructure and surface', () => {
  assert.equal(bikeBand({ kind: 'path' }), 'path')
  assert.equal(bikeBand({ kind: 'street', bikeway: 'dedicated' }), 'path')
  assert.equal(bikeBand({ kind: 'street', bikeway: 'lane' }), 'lane')
  assert.equal(bikeBand({ kind: 'street' }), 'none')
  assert.equal(surfaceBand({ kind: 'street' }), 'paved')
  assert.equal(surfaceBand({ kind: 'street', surface: 'gravel' }), 'unpaved')
  assert.equal(surfaceBand({ kind: 'path' }), 'unknown')
  assert.deepEqual(comfortBands({ kind: 'path', highway: 'cycleway', surface: 'asphalt' }), {
    type_band: 'path',
    speed_band: '30',
    bike_band: 'path',
    surface_band: 'paved',
  })
})

test('adds up km by every combination of bands, the comfort layer only', () => {
  const totals = comfortTotals()
  const street = {
    lts: 3,
    kind: 'street',
    ...comfortBands({ kind: 'street', highway: 'tertiary', maxspeed: '50', lanes: '2' }, {}),
  }
  totals.add(street, 1500)
  totals.add(street, 500)
  totals.add({ lts: 0, kind: 'street' }, 900)
  assert.deepEqual(totals.toJSON(), {
    sets: ['stress', 'type', 'speed', 'lanes', 'bikeway', 'surface', 'lit'],
    rows: [['3', 'tertiary', '50', '1', 'none', 'paved', 'no', 2]],
  })
})
