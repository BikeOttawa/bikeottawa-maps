import { useEffect, useState } from 'react'
import { ASSETS_BASE } from './config'
import type { ConstructionProps } from './construction'

/**
 * The City's construction projects, for the projects legend's counts: the file
 * the map shows, loaded again each time the layer is turned on, as the map
 * loads it, so the two never count from different nights' files. Null until it
 * arrives, or when the tiles build could not fetch it.
 */
export function useProjects(enabled: boolean): readonly ConstructionProps[] | null {
  const [projects, setProjects] = useState<readonly ConstructionProps[] | null>(null)
  useEffect(() => {
    if (!enabled) {
      setProjects(null)
      return
    }
    if (projects) return
    const controller = new AbortController()
    fetch(`${ASSETS_BASE}/tiles/construction.geojson`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json: { features: { properties: ConstructionProps }[] }) =>
        setProjects(json.features.map((f) => f.properties)),
      )
      .catch(() => {})
    return () => controller.abort()
  }, [enabled, projects])
  return projects
}
