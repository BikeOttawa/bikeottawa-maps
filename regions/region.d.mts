/** Wording of the region's own, in each language the site speaks. */
export interface Text {
  en: string
  fr: string
}

/** Whose data it is, for the map's credits. */
export interface Credit {
  name: string
  url: string
}

/** One kind of the city's own data: whose it is, and how its legend names it. */
export interface CityData {
  credits: Credit[]
  /** The source as the legend names it: "City of Ottawa open data". */
  source?: Text
  /** A sentence more about the data, after the source. */
  note?: Text
}

export type CityDataKind = 'collisions' | 'thefts' | 'construction' | 'wards'

/** What a region.json holds; regions/README.md says what each field is for. */
export interface Region {
  title: Text
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
  cityData?: Partial<Record<CityDataKind, CityData>>
  roadwork?: string[]
  elevation?: { url: string; credit: Credit }
  org?: { name: string; url: string; join?: string; volunteer?: string; donate?: string }
  repo: string
  osm: { createdBy: string; hashtag: string }
  oldPages?: Record<string, string>
}

export function loadRegion(): { id: string; dir: string; region: Region }
export function siteFiles(dir: string): Record<string, Uint8Array>
