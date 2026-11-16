import assert from 'node:assert/strict'
import { test } from 'node:test'
import { codedValues, impactsText, kindOf, timingOf } from './construction.mjs'

test('sorts project types into kinds of work', () => {
  assert.equal(kindOf('MMUP'), 'cycling')
  assert.equal(kindOf('MCR'), 'cycling')
  assert.equal(kindOf('RRR'), 'roads')
  assert.equal(kindOf('RWM'), 'water')
  assert.equal(kindOf('SCR'), 'bridges')
  assert.equal(kindOf('LRT'), 'transit')
  assert.equal(kindOf('OBLDG'), 'other')
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
