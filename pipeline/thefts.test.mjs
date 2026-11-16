import assert from 'node:assert/strict'
import { test } from 'node:test'
import { bikeType, makeNamer, ottawaDay, takenFrom } from './thefts.mjs'

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
})

test('reads dates as days in Ottawa', () => {
  // Midnight in Ottawa, in winter (UTC-5) and in summer (UTC-4).
  assert.equal(ottawaDay(Date.UTC(2015, 11, 9, 5)), '2015-12-09')
  assert.equal(ottawaDay(Date.UTC(2019, 6, 1, 4)), '2019-07-01')
})
