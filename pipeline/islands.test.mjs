import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isCrossing, islandIndex } from './islands.mjs'

test('ways that share a point make one island, its length theirs together', () => {
  const islands = islandIndex()
  const a = [
    [0, 0],
    [1, 0],
  ]
  const b = [
    [2, 0],
    [1, 0],
    [1, 1],
  ]
  const apart = [
    [5, 5],
    [6, 5],
  ]
  islands.add(a, 100)
  islands.add(b, 50)
  islands.add(apart, 30)
  assert.equal(islands.length(a), 150)
  assert.equal(islands.length(b), 150)
  assert.equal(islands.length(apart), 30)
})

test('a crossing joins two islands without adding to their length', () => {
  const islands = islandIndex()
  const west = [
    [0, 0],
    [1, 0],
  ]
  const east = [
    [2, 0],
    [3, 0],
  ]
  islands.add(west, 100)
  islands.add(east, 200)
  assert.equal(islands.length(west), 100)
  islands.add(
    [
      [1, 0],
      [2, 0],
    ],
    0,
  )
  assert.equal(islands.length(west), 300)
  assert.equal(islands.length(east), 300)
})

test('crossings are told by their footway, cycleway or path tag', () => {
  assert.equal(isCrossing({ highway: 'footway', footway: 'crossing' }), true)
  assert.equal(isCrossing({ highway: 'cycleway', cycleway: 'crossing' }), true)
  assert.equal(isCrossing({ highway: 'footway', footway: 'sidewalk' }), false)
})
