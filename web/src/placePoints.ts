import type { FeatureCollection, Point } from 'geojson'
import { useEffect, useState } from 'react'
import { ASSETS_BASE } from './config'
import { PLACE_GROUP_IDS, type PlaceKind, placeGroup } from './places'

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

/**
 * The places of the kinds picked, for the map to merge when zoomed out: each
 * with its kind and its group's place in PLACE_GROUP_IDS (`g`). Null until loaded.
 */
export function usePlacePoints(kinds: readonly PlaceKind[], enabled: boolean): FeatureCollection<Point> | null {
  const [geo, setGeo] = useState<FeatureCollection<Point> | null>(null)
  useEffect(() => {
    if (!enabled || !kinds.length) {
      setGeo(null)
      return
    }
    let current = true
    Promise.all(kinds.map(placePoints)).then((lists) => {
      if (!current) return
      const features: FeatureCollection<Point>['features'] = []
      kinds.forEach((kind, i) => {
        const g = PLACE_GROUP_IDS.indexOf(placeGroup(kind))
        const list = lists[i]
        for (let j = 0; j < list.length; j += 2) {
          features.push({
            type: 'Feature',
            properties: { kind, g },
            geometry: { type: 'Point', coordinates: [list[j], list[j + 1]] },
          })
        }
      })
      setGeo({ type: 'FeatureCollection', features })
    })
    return () => {
      current = false
    }
  }, [kinds, enabled])
  return geo
}
