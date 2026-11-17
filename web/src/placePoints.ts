import type { FeatureCollection, Point } from 'geojson'
import { useEffect, useState } from 'react'
import { ASSETS_BASE } from './config'
import { type PlaceGroupId, type PlaceKind, placeGroup } from './places'

/** Each kind's places, as the pipeline writes them: [lon, lat, lon, lat, ...]. Fetched once each. */
const points = new Map<PlaceKind, Promise<number[]>>()

export function placePoints(kind: PlaceKind): Promise<number[]> {
  let pending = points.get(kind)
  if (!pending) {
    pending = fetch(`${ASSETS_BASE}/tiles/places/${kind}.json`)
      .then((res) => (res.ok ? (res.json() as Promise<number[]>) : Promise.reject(new Error(String(res.status)))))
      .catch(() => {
        // Tried again next time.
        points.delete(kind)
        return []
      })
    points.set(kind, pending)
  }
  return pending
}

/** The places of the kinds picked, by group, each with its kind: the map merges a group's when zoomed out. */
export type PlacePoints = Partial<Record<PlaceGroupId, FeatureCollection<Point>>>

/** Null until loaded. */
export function usePlacePoints(kinds: readonly PlaceKind[], enabled: boolean): PlacePoints | null {
  const [byGroup, setByGroup] = useState<PlacePoints | null>(null)
  useEffect(() => {
    if (!enabled || !kinds.length) {
      setByGroup(null)
      return
    }
    let current = true
    Promise.all(kinds.map(placePoints)).then((lists) => {
      if (!current) return
      const next: PlacePoints = {}
      kinds.forEach((kind, i) => {
        const list = lists[i]
        const group = next[placeGroup(kind)] ?? { type: 'FeatureCollection', features: [] }
        next[placeGroup(kind)] = group
        for (let j = 0; j < list.length; j += 2) {
          group.features.push({
            type: 'Feature',
            properties: { kind },
            geometry: { type: 'Point', coordinates: [list[j], list[j + 1]] },
          })
        }
      })
      setByGroup(next)
    })
    return () => {
      current = false
    }
  }, [kinds, enabled])
  return byGroup
}
