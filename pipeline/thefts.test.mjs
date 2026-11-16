import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bikeType, colours, makeNamer, modelName, ottawaDay, takenFrom, withoutCopies } from './thefts.mjs'

test('tells where a bike was taken from by the offence', () => {
  assert.equal(takenFrom('Theft< Bicycle'), 'outdoors')
  assert.equal(takenFrom('Theft> Bicycle'), 'outdoors')
  assert.equal(takenFrom('B&E Residence'), 'home')
  assert.equal(takenFrom('B&E Non- Residenc'), 'building')
  assert.equal(takenFrom('Theft< Frm Vehicl'), 'other')
  assert.equal(takenFrom(null), 'other')
})

test("groups bike types, a child's bike first", () => {
  assert.equal(bikeType('Mountain', "Men's"), 'mountain')
  assert.equal(bikeType('Racer', 'Unisex'), 'road')
  assert.equal(bikeType('Touring', "Women's"), 'road')
  assert.equal(bikeType('Regular', 'Unisex'), 'city')
  assert.equal(bikeType('Mountain', "Child's"), 'kids')
  assert.equal(bikeType('Bmx', "Men's"), 'other')
})

test('cleans makes: cut-off names, unknowns, case', () => {
  const name = makeNamer(['GIANT', 'GIANT', 'GIAN', 'CCM', 'ROCKY MOUNTAIN', 'UNKNOWN', 'noda', 'TREK'])
  assert.equal(name('GIAN'), 'Giant')
  assert.equal(name('giant'), 'Giant')
  assert.equal(name('CCM'), 'CCM')
  assert.equal(name('ROCKY MOUNTAIN'), 'Rocky Mountain')
  assert.equal(name('noda'), undefined)
  assert.equal(name('UNKNOWN'), undefined)
  assert.equal(name(null), undefined)
  // A four-letter make with no longer one to stand for is kept.
  assert.equal(name('TREK'), 'Trek')
  // Nor does a whole four-letter make become a longer name written less often.
  const treks = makeNamer(['TREK', 'TREK', 'TREK FX'])
  assert.equal(treks('TREK'), 'Trek')
})

test('reads colour codes run together', () => {
  assert.deepEqual(colours('BLKRED'), ['black', 'red'])
  assert.deepEqual(colours('DBLLBL'), ['blue'])
  assert.deepEqual(colours('noda'), [])
  assert.deepEqual(colours(null), [])
})

test('writes models plainly, codes in capitals', () => {
  assert.equal(modelName('DUAL SPORT 3'), 'Dual Sport 3')
  assert.equal(modelName('FSX4'), 'FSX4')
  assert.equal(modelName(' unknown '), undefined)
})

test('drops exact copies of a record, keeps different bikes', () => {
  const row = (id, model) => ({ attributes: { ID: id, OBJECTID: id, OCC_DATE: 1, BIKE_MODEL: model } })
  const kept = withoutCopies([row(1, 'FSX4'), row(2, 'DUAL SPORT 3'), row(3, 'FSX4')])
  assert.deepEqual(
    kept.map((r) => r.attributes.ID),
    [1, 2],
  )
})

test('reads dates as days in Ottawa', () => {
  // Midnight in Ottawa, in winter (UTC-5) and in summer (UTC-4).
  assert.equal(ottawaDay(Date.UTC(2015, 11, 9, 5)), '2015-12-09')
  assert.equal(ottawaDay(Date.UTC(2019, 6, 1, 4)), '2019-07-01')
})
