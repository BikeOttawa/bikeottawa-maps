import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codedValues, impactsText, kindOf, lengthOf, timingOf, webPage } from './construction.mjs'

test('sorts project types into kinds of work', () => {
  assert.equal(kindOf('MMUP'), 'cycling')
  assert.equal(kindOf('MCR'), 'cycling')
  assert.equal(kindOf('RRR'), 'roads')
  assert.equal(kindOf('RWM'), 'water')
  assert.equal(kindOf('SCR'), 'bridges')
  assert.equal(kindOf('LRT'), 'transit')
  assert.equal(kindOf('OBLDG'), 'other')
  // The road programme's codes: a pathway or sidewalk is for cycling and walking, the rest is road.
  assert.equal(kindOf('RD_MUPR'), 'cycling')
  assert.equal(kindOf('RD_SWRE'), 'cycling')
  assert.equal(kindOf('RD_RESF'), 'roads')
  assert.equal(kindOf('RD_GRRNI'), 'roads')
})

test('tells when the work happens', () => {
  assert.equal(timingOf('INPROGRESS', 'This Year'), 'now')
  assert.equal(timingOf('PLANNED', 'This Year'), 'thisYear')
  assert.equal(timingOf('PLANNED', '1-2 Years'), 'soon')
  assert.equal(timingOf('PLANNED', '2-3 Years'), 'later')
})

test('reads coded values and drops empty traffic impacts', () => {
  const layer = { fields: [{ name: 'X', domain: { codedValues: [{ code: 'A', name: 'New  Sewer P.S.' }] } }] }
  assert.equal(codedValues(layer, 'X').get('A'), 'New Sewer P.S.')
  assert.equal(impactsText(' None. '), undefined)
  assert.equal(impactsText('N/A'), undefined)
  assert.equal(impactsText('Lane closures on Bank St.'), 'Lane closures on Bank St.')
})

test('keeps only real web pages, and measures lines', () => {
  assert.equal(webPage('WCC'), undefined)
  assert.equal(webPage(' TEST '), undefined)
  assert.equal(webPage('https://ottawa.ca/en/projects'), 'https://ottawa.ca/en/projects')
  // A hundredth of a degree of latitude is about 1.1 km.
  const metres = lengthOf({
    type: 'LineString',
    coordinates: [
      [-75.7, 45.4],
      [-75.7, 45.41],
    ],
  })
  assert.ok(metres > 1100 && metres < 1110)
  assert.equal(lengthOf({ type: 'Point', coordinates: [-75.7, 45.4] }), 0)
})
