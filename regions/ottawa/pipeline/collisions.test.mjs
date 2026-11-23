import assert from 'node:assert/strict'
import { test } from 'node:test'
import { withoutCopies } from './collisions.mjs'

const row = (ID, Lat, Long, Max_injury = 'Fatal') => ({
  ID,
  Accident_Date: '2024-01-02',
  Location: 'BANK ST btwn RIDGEMONT AVE & PORTLAND AVE',
  Max_injury,
  Lat,
  Long,
})

test('drops copies of a collision a few metres apart, keeping the first', () => {
  const kept = withoutCopies([
    row('a', 45.376526, -75.666499),
    row('b', 45.376376, -75.66643), // 17 m away
    row('c', 45.376526, -75.666499, 'Minor'), // another collision
    row('d', 45.38, -75.666499), // the same, but 390 m away
  ])
  assert.deepEqual(
    kept.map((r) => r.ID),
    ['a', 'c', 'd'],
  )
})
