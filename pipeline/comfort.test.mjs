import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bikeBand, comfortBands, comfortTotals, laneBand, speedBand, surfaceBand } from './comfort.mjs'

test('bands speed limits, untagged as unknown, none on paths', () => {
  assert.equal(speedBand({ kind: 'street', maxspeed: '30' }), '30')
  assert.equal(speedBand({ kind: 'street', maxspeed: '40 km/h' }), '40')
  assert.equal(speedBand({ kind: 'street', maxspeed: '50' }), '50')
  assert.equal(speedBand({ kind: 'street', maxspeed: '80' }), '70')
  assert.equal(speedBand({ kind: 'street' }), 'unknown')
  assert.equal(speedBand({ kind: 'street', maxspeed: 'CA:ON:urban' }), 'unknown')
  assert.equal(speedBand({ kind: 'path' }), undefined)
})

test('bands lanes in all', () => {
  assert.equal(laneBand({ kind: 'street', lanes: '2' }), 'few')
  assert.equal(laneBand({ kind: 'street', lanes: '4' }), 'many')
  assert.equal(laneBand({ kind: 'street' }), 'unknown')
  assert.equal(laneBand({ kind: 'path' }), undefined)
})

test('sorts bike infrastructure and surface', () => {
  assert.equal(bikeBand({ kind: 'path' }), 'path')
  assert.equal(bikeBand({ kind: 'street', bikeway: 'dedicated' }), 'path')
  assert.equal(bikeBand({ kind: 'street', bikeway: 'lane' }), 'lane')
  assert.equal(bikeBand({ kind: 'street' }), 'none')
  assert.equal(surfaceBand({ kind: 'street' }), 'paved')
  assert.equal(surfaceBand({ kind: 'street', surface: 'gravel' }), 'unpaved')
  assert.equal(surfaceBand({ kind: 'path' }), 'unknown')
  assert.deepEqual(comfortBands({ kind: 'path', surface: 'asphalt' }), { bike_band: 'path', surface_band: 'paved' })
})

test('adds up km by every combination of bands, the comfort layer only', () => {
  const totals = comfortTotals()
  const street = { lts: 3, kind: 'street', ...comfortBands({ kind: 'street', maxspeed: '50', lanes: '2' }) }
  totals.add(street, 1500)
  totals.add(street, 500)
  totals.add({ lts: 0, kind: 'street' }, 900)
  assert.deepEqual(totals.toJSON(), {
    sets: ['stress', 'speed', 'lanes', 'bikeway', 'surface'],
    rows: [['3', '50', 'few', 'none', 'paved', 2]],
  })
})
