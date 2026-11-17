/**
 * Photos of places, from what a mapper linked in OSM: `mapillary=<image id>`
 * or `image:fotoshi=<photo id>` (often several, separated by ;),
 * `image=<url>` or `wikimedia_commons=<page>`.
 */

/** The Fotoshi photo ids in a place's `image:fotoshi` tag. */
export function fotoshiIds(value: unknown): string[] {
  return String(value ?? '')
    .split(';')
    .map((id) => id.trim())
    .filter((id) => /^[A-Za-z0-9_-]{16,40}$/.test(id))
}

/**
 * A Fotoshi photo, straight from its CDN: no API call, so no key. The photo's
 * page names the photographer, which is how its CC BY licence asks for credit.
 */
export function fotoshiPhoto(id: string): Photo {
  return {
    url: `https://cdn.fotoshi.com/images/${id}-640.jpeg`,
    largeUrl: `https://cdn.fotoshi.com/images/${id}-2048.jpeg`,
    credit: 'Fotoshi · CC BY 4.0',
    link: `https://fotoshi.com/photo/${id}`,
  }
}

/** Fotoshi's photo search: the photos of an OSM object, or those taken around a point. */
const FOTOSHI_PHOTOS = 'https://api.fotoshi.com/v1/data/photos'

/** How far from a point Fotoshi photos are looked for, in metres. */
const FOTOSHI_RADIUS_M = 30

/** A place's OSM identity as Fotoshi takes it: `node/123` is `n123`. */
export function fotoshiOsmId(osm: unknown): string | null {
  const match = /^(node|way|relation)\/([1-9]\d*)$/.exec(String(osm ?? ''))
  return match ? `${match[1][0]}${match[2]}` : null
}

/** What to ask Fotoshi for: the photos linked to an OSM object, or those taken around a point. */
export type FotoshiQuery = { osmId: string } | { at: readonly [number, number] }

export function fotoshiSearchUrl(query: FotoshiQuery): string {
  const params = new URLSearchParams(
    'osmId' in query
      ? { osm_id: query.osmId }
      : { lon: query.at[0].toFixed(6), lat: query.at[1].toFixed(6), radius: String(FOTOSHI_RADIUS_M) },
  )
  params.set('limit', '10')
  params.set('photo_size', 'thumbnail,1280')
  return `${FOTOSHI_PHOTOS}?${params}`
}

/** A Fotoshi photo, and how far from the point asked about it was taken. */
export interface FotoshiShot {
  photo: Photo
  distance?: number
}

/**
 * Fotoshi's answer as photos, closest first around a point. A photo needs an
 * https image, its licence and someone to credit, or it is left out.
 */
export function parseFotoshiPhotos(json: unknown, at?: readonly [number, number]): FotoshiShot[] {
  const text = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null)
  const features = (json as { type?: unknown; features?: unknown } | null)?.features
  if (!Array.isArray(features)) return []
  const seen = new Set<string>()
  const shots: FotoshiShot[] = []
  for (const feature of features as { id?: unknown; geometry?: unknown; properties?: Record<string, unknown> }[]) {
    const id = text(feature?.id)
    const p = feature?.properties
    if (!id || !/^[A-Za-z0-9_-]+$/.test(id) || !p || seen.has(id)) continue
    const assets = (p.assets ?? {}) as Record<string, { href?: unknown } | undefined>
    const href = (name: string) => {
      const url = text(assets[name]?.href)
      return url?.startsWith('https://') ? url : null
    }
    const large = href('image-1280')
    const licence = text(p.image_license)?.replace(/-/g, ' ')
    const names = [text(p.creator_name) ?? text(p.username), text(p.source_organization)].filter(
      (name, i, all): name is string => name !== null && all.indexOf(name) === i,
    )
    if (!large || !licence || !names.length) continue
    seen.add(id)
    const day = text(p.captured_at)
    const geometry = feature.geometry as { type?: string; coordinates?: [number, number] } | null
    const where = geometry?.type === 'Point' ? geometry.coordinates : null
    shots.push({
      photo: {
        url: large,
        largeUrl: large,
        credit: `© ${names.join(' · ')} · Fotoshi · ${licence}`,
        link: `https://fotoshi.com/photo/${id}`,
        // A day only: noon keeps it on that day in any time zone.
        ...(day && /^\d{4}-\d{2}-\d{2}$/.test(day) && { takenAt: Date.parse(`${day}T12:00:00`) }),
      },
      ...(at && where && { distance: metres(at, where) }),
    })
  }
  return at ? shots.sort((a, b) => (a.distance ?? Infinity) - (b.distance ?? Infinity)) : shots
}

/** The Fotoshi photos of an OSM object, or around a point; none when the service is down or says no. */
export async function fetchFotoshiPhotos(
  query: FotoshiQuery,
  key: string,
  signal?: AbortSignal,
): Promise<FotoshiShot[]> {
  const res = await fetch(fotoshiSearchUrl(query), {
    headers: { Authorization: `Bearer ${key}`, Accept: 'application/geo+json, application/json' },
    signal,
  })
  if (!res.ok) return []
  return parseFotoshiPhotos(await res.json(), 'at' in query ? query.at : undefined)
}

/** The first Mapillary image id in a place's `mapillary` tag. */
export function mapillaryId(value: unknown): string | null {
  const first = String(value ?? '')
    .split(';')[0]
    .trim()
  return /^\d{6,}$/.test(first) ? first : null
}

/** A web link from a place's `image` tag, if it is one. */
export function imageLink(value: unknown): string | null {
  const text = String(value ?? '').trim()
  return /^https?:\/\/\S+$/.test(text) ? text : null
}

/** An `image` link that is itself a picture (many are web pages, e.g. Google Photos albums). */
export function directImage(value: unknown): string | null {
  const link = imageLink(value)
  return link && /\.(jpe?g|png|webp)(\?\S*)?$/i.test(link) ? link : null
}

/** The Wikimedia Commons page a `wikimedia_commons` tag names (a file or a category). */
export function commonsLink(value: unknown): string | null {
  const page = String(value ?? '').trim()
  return /^(File|Category):\S/.test(page)
    ? `https://commons.wikimedia.org/wiki/${encodeURI(page.replaceAll(' ', '_'))}`
    : null
}

export function mapillaryViewerUrl(id: string): string {
  return `https://www.mapillary.com/app/?pKey=${id}&focus=photo`
}

/** Google Street View at the panorama nearest a point. */
export function streetViewUrl([lon, lat]: readonly [number, number]): string {
  return `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat.toFixed(6)},${lon.toFixed(6)}`
}

export interface Photo {
  /** The image, sized for the card. Mapillary's links expire, so they are fetched when needed. */
  url: string
  /** A larger copy, for viewing it over the map. */
  largeUrl: string
  /** Who or where it is from, for the credit line. */
  credit: string
  /** Where to see it at its source. */
  link: string
  /** When it was taken, ms since 1970, if known. */
  takenAt?: number
  /** The Mapillary capture run it belongs to. */
  sequence?: string
}

export async function fetchMapillaryPhoto(id: string, token: string, signal?: AbortSignal): Promise<Photo | null> {
  const params = new URLSearchParams({
    fields: 'thumb_1024_url,thumb_2048_url,creator,captured_at,sequence',
    access_token: token,
  })
  const res = await fetch(`https://graph.mapillary.com/${id}?${params}`, { signal })
  if (!res.ok) return null
  const data = (await res.json()) as {
    thumb_1024_url?: string
    thumb_2048_url?: string
    creator?: { username?: string }
    captured_at?: number
    sequence?: string
  }
  if (!data.thumb_1024_url) return null
  const by = data.creator?.username
  return {
    url: data.thumb_1024_url,
    largeUrl: data.thumb_2048_url ?? data.thumb_1024_url,
    credit: by ? `© ${by} · Mapillary` : '© Mapillary',
    link: mapillaryViewerUrl(id),
    takenAt: data.captured_at,
    sequence: data.sequence,
  }
}

/** A picture linked directly, credited to the site it is on. */
export function directPhoto(url: string): Photo {
  const host = new URL(url).hostname.replace(/^(www|storage\d*)\./, '')
  return { url, largeUrl: url, credit: host, link: url }
}

interface MapillaryImage {
  id: string
  computed_geometry?: { coordinates: [number, number] }
  is_pano?: boolean
  /** The capture run it belongs to; one run's photos are often a metre apart. */
  sequence?: string
}

/** A photo near a point, and how far from it it was taken. */
export interface NearbyImage {
  id: string
  distance: number
  /** The capture run, to leave out near-copies of a photo already shown. */
  sequence?: string
}

/** Metres between two nearby points. */
function metres([lon1, lat1]: readonly [number, number], [lon2, lat2]: readonly [number, number]): number {
  const kx = 111320 * Math.cos((lat1 * Math.PI) / 180)
  return Math.hypot((lon2 - lon1) * kx, (lat2 - lat1) * 111320)
}

/**
 * The photos worth stepping through, best first: the closest from each
 * capture run (the rest of a run are near-copies), panoramas counted a little
 * farther away because they look stretched in a card.
 */
export function nearbyImages(images: readonly MapillaryImage[], at: readonly [number, number]): NearbyImage[] {
  const bestPerRun = new Map<string, NearbyImage & { score: number }>()
  for (const image of images) {
    const where = image.computed_geometry?.coordinates
    if (!where) continue
    const distance = metres(at, where)
    const score = distance + (image.is_pano ? 15 : 0)
    const run = image.sequence ?? image.id
    const best = bestPerRun.get(run)
    if (!best || score < best.score) bestPerRun.set(run, { id: image.id, distance, sequence: image.sequence, score })
  }
  return [...bestPerRun.values()]
    .sort((a, b) => a.score - b.score)
    .map(({ id, distance, sequence }) => ({ id, distance, sequence }))
}

/**
 * Searches around the point, about ±25 m first and ±70 m if nothing is that
 * close. Mapillary returns a sample, not the closest, when a box holds more
 * photos than asked for, so the first box is kept small.
 */
const SEARCH_BOXES = [
  { degrees: 0.0002, limit: 100 },
  { degrees: 0.0006, limit: 500 },
]

/** Street-level photos taken near a point, best first (see nearbyImages). */
export async function findNearbyMapillary(
  at: readonly [number, number],
  token: string,
  signal?: AbortSignal,
): Promise<NearbyImage[]> {
  const [lon, lat] = at
  for (const { degrees, limit } of SEARCH_BOXES) {
    const dLon = degrees / Math.cos((lat * Math.PI) / 180)
    const bbox = [lon - dLon, lat - degrees, lon + dLon, lat + degrees].map((v) => v.toFixed(6)).join(',')
    const params = new URLSearchParams({
      fields: 'id,computed_geometry,is_pano,sequence',
      bbox,
      limit: String(limit),
      access_token: token,
    })
    const res = await fetch(`https://graph.mapillary.com/images?${params}`, { signal })
    if (!res.ok) return []
    const { data } = (await res.json()) as { data?: MapillaryImage[] }
    const found = nearbyImages(data ?? [], at)
    if (found.length) return found
  }
  return []
}
