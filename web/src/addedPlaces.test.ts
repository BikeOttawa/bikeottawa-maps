import { describe, expect, it } from 'vitest'
import { type AddedPlace, notInTiles, withAdded } from './addedPlaces'

const place = (added: string): AddedPlace => ({
  osm: 'node/1',
  kind: 'bench',
  at: [-75.69, 45.42],
  tags: { amenity: 'bench' },
  added,
})

describe('withAdded', () => {
  it('puts the places added of that kind with the pipeline’s', () => {
    const bench = place('2026-11-25T09:00:00Z')
    const parking = { ...bench, kind: 'parking' as const, at: [-75.7, 45.4] as [number, number] }
    expect(withAdded([-75.6, 45.3], 'parking', [bench, parking])).toEqual([-75.6, 45.3, -75.7, 45.4])
  })
})

describe('notInTiles', () => {
  const now = Date.parse('2026-11-25T12:00:00Z')

  it('keeps places added after the data the tiles were built from', () => {
    const before = place('2026-11-24T10:00:00Z')
    const after = place('2026-11-25T09:00:00Z')
    expect(notInTiles([before, after], '2026-11-25T02:00:00Z', now)).toEqual([after])
  })

  it('keeps a place sent as a note until the tiles are newer than its note’s closing', () => {
    const open = { ...place('2026-11-01T10:00:00Z'), osm: 'note/5' }
    const closedLater = { ...open, osm: 'note/6', closed: '2026-11-25T08:00:00Z' }
    const closedBefore = { ...open, osm: 'note/7', closed: '2026-11-24T08:00:00Z' }
    expect(notInTiles([open, closedLater, closedBefore], '2026-11-25T02:00:00Z', now)).toEqual([open, closedLater])
    // A note left open for months lets go of its place too.
    expect(notInTiles([open], '2026-11-25T02:00:00Z', Date.parse('2027-02-01T00:00:00Z'))).toEqual([])
  })

  it('keeps them all while the tiles’ date is not known, but not for ever', () => {
    const recent = place('2026-11-20T10:00:00Z')
    const old = place('2026-11-01T10:00:00Z')
    expect(notInTiles([recent, old], undefined, now)).toEqual([recent])
  })
})
