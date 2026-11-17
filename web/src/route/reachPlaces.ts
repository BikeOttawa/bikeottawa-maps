import { useEffect, useState } from 'react'
import { placePoints } from '../placePoints'
import type { PlaceKind } from '../places'
import type { LngLat } from './brouter'
import { coveredPoints, type ReachCover } from './reach'

export interface PlaceCount {
  kind: PlaceKind
  /** Where the places within reach are. */
  points: LngLat[]
}

/** The places of each kind within reach; null until they are counted. */
export function useReachPlaces(cover: ReachCover | null, kinds: readonly PlaceKind[]): PlaceCount[] | null {
  const [counts, setCounts] = useState<PlaceCount[] | null>(null)
  useEffect(() => {
    setCounts(null)
    if (!cover || !kinds.length) return
    let current = true
    Promise.all(kinds.map(placePoints)).then((lists) => {
      if (current) setCounts(kinds.map((kind, i) => ({ kind, points: coveredPoints(lists[i], cover) })))
    })
    return () => {
      current = false
    }
  }, [cover, kinds])
  return counts
}
