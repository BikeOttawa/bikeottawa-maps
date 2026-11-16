import { useEffect, useState } from 'react'
import type { Collision, CollisionProps } from './collisions'
import { DATA_BASE } from './config'
import type { Theft, TheftProps } from './thefts'

/**
 * Points from one of the data files in public/data, loaded the first time
 * their layer is on and kept after that. Null until they arrive.
 */
function usePoints<P>(file: string, enabled: boolean): readonly { props: P; at: [number, number] }[] | null {
  const [data, setData] = useState<readonly { props: P; at: [number, number] }[] | null>(null)
  useEffect(() => {
    if (!enabled || data) return
    const controller = new AbortController()
    fetch(`${DATA_BASE}/data/${file}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { features: { properties: P; geometry: { coordinates: [number, number] } }[] }) =>
        setData(json.features.map((f) => ({ props: f.properties, at: f.geometry.coordinates }))),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [file, enabled, data])
  return data
}

export const useCollisionData = (enabled: boolean): readonly Collision[] | null =>
  usePoints<CollisionProps>('collisions.geojson', enabled)

export const useTheftData = (enabled: boolean): readonly Theft[] | null =>
  usePoints<TheftProps>('thefts.geojson', enabled)
