/** What a region.json holds; regions/README.md says what each field is for. */
export interface Region {
  title: { en: string; fr: string }
  shortTitle: string
  description: string
  name: string
  bbox: [west: number, south: number, east: number, north: number]
  center: [lon: number, lat: number]
  timeZone: string
  routingBbox: [west: number, south: number, east: number, north: number]
  extracts: { pbf: string; poly: string }[]
  replicationUrl: string
  profiles: { bike: string; walk: string }
  cityData?: string[]
  elevation?: string
  org?: { name: string; url: string; join?: string; volunteer?: string; donate?: string }
  repo: string
  osm: { createdBy: string; hashtag: string }
  oldPages?: Record<string, string>
}

export function loadRegion(): { id: string; dir: string; region: Region }
export function siteFiles(dir: string): Record<string, Uint8Array>
