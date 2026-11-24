import assert from 'node:assert/strict'
import { test } from 'node:test'
import { districtName, labelPoint, lighten, ottawaCouncillors, simplifyRing } from './wards.mjs'

test('takes the councillor in office now when a ward changed hands', () => {
  const rows = [
    { ObjectId: 1, Ward_number: null, Primary_Role: 'Mayor', First_name: 'A', Last_name: 'Mayor' },
    {
      ObjectId: 2,
      Ward_number: '20',
      Ward_name: 'Osgoode (June 18, 2025 to present)',
      Primary_Role: 'Councillor',
      First_name: 'New',
      Last_name: 'One',
    },
    {
      ObjectId: 3,
      Ward_number: '20',
      Ward_name: 'Osgoode (November 15, 2022 to February 27, 2025)',
      Primary_Role: 'Councillor',
      First_name: 'Old',
      Last_name: 'One',
    },
    {
      ObjectId: 4,
      Ward_number: '4',
      Ward_name: 'Kanata North',
      Primary_Role: 'Councillor',
      First_name: 'Cathy ',
      Last_name: ' Curry',
    },
  ]
  assert.deepEqual(
    [...ottawaCouncillors(rows)],
    [
      [20, 'New One'],
      [4, 'Cathy Curry'],
    ],
  )
})

test("drops the article from Gatineau's district names", () => {
  assert.equal(districtName("d'Aylmer"), 'Aylmer')
  assert.equal(districtName('de la Rivière-Blanche'), 'Rivière-Blanche')
  assert.equal(districtName("de l'Orée-du-Parc"), 'Orée-du-Parc')
  assert.equal(districtName('du Plateau'), 'Plateau')
  assert.equal(districtName('de Deschênes'), 'Deschênes')
})

test('simplifies a ring without losing its corners', () => {
  const ring = [
    [0, 0],
    [0.5, 0.00001],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ]
  assert.deepEqual(simplifyRing(ring, 0.0001), [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
    [0, 0],
  ])
  const polygon = lighten({ type: 'Polygon', coordinates: [ring] })
  assert.equal(polygon.coordinates[0].length, 5)
})

test('puts the label well inside the ward, in its largest part', () => {
  // An L shape: the label goes in the wide arm, not at the corner of the bounding box.
  const l = [
    [0, 0],
    [3, 0],
    [3, 1],
    [1, 1],
    [1, 3],
    [0, 3],
    [0, 0],
  ]
  const [x, y] = labelPoint({ type: 'Polygon', coordinates: [l] })
  assert.ok(x > 0 && x < 3 && y > 0 && y < 3 && (x < 1 || y < 1))
  const small = [
    [10, 10],
    [10.1, 10],
    [10.1, 10.1],
    [10, 10.1],
    [10, 10],
  ]
  const [mx] = labelPoint({ type: 'MultiPolygon', coordinates: [[small], [l]] })
  assert.ok(mx < 3)
})
