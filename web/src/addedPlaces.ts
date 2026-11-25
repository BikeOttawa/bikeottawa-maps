import type { PlaceKind } from './places'

/**
 * Places this person added, kept on their map, in this browser, until the
 * tiles have them: those are built from OSM once a night. One sent as a note
 * waits for a mapper to add it: until its note is closed, then for the tiles.
 */

export interface AddedPlace {
  /** Where it is on OSM: "node/123", or "note/45" while a note asks mappers to add it. */
  osm: string
  kind: PlaceKind
  at: [number, number]
  tags: Record<string, string>
  /** When it was added, as an ISO date. */
  added: string
  /** For a note, when it was closed, as an ISO date, once known. */
  closed?: string
}

const KEY = 'added-places'
const DAY = 86_400_000
/** Past this, a place is dropped even if the tiles seem not to have it: they may have stopped updating. */
const KEEP_DAYS = 14
/** Notes can wait a long while for a mapper; past this, the place is dropped all the same. */
const NOTE_KEEP_DAYS = 60

/** The note's number, for a place sent as one. */
export function noteOf(place: { osm: string }): number | null {
  return place.osm.startsWith('note/') ? Number(place.osm.slice('note/'.length)) : null
}

/** A kind's places as the pipeline writes them ([lon, lat, …]), with those of that kind this person added. */
export function withAdded(flat: readonly number[], kind: PlaceKind, added: readonly AddedPlace[]): number[] {
  return [...flat, ...added.filter((place) => place.kind === kind).flatMap((place) => place.at)]
}

export function storedAddedPlaces(): AddedPlace[] {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(stored) ? stored : []
  } catch {
    return []
  }
}

export function rememberAddedPlaces(places: readonly AddedPlace[]): void {
  try {
    if (places.length) localStorage.setItem(KEY, JSON.stringify(places))
    else localStorage.removeItem(KEY)
  } catch {
    // Kept for this visit only.
  }
}

/**
 * Those the tiles do not have yet: added to OSM, or their note closed, after
 * the OSM data the tiles were built from; and not long ago.
 */
export function notInTiles(places: readonly AddedPlace[], tilesOsmTime: string | undefined, now = Date.now()) {
  const tiles = tilesOsmTime ? Date.parse(tilesOsmTime) : Number.NaN
  return places.filter((place) => {
    const noted = noteOf(place) !== null
    const inOsm = noted ? (place.closed ? Date.parse(place.closed) : Number.POSITIVE_INFINITY) : Date.parse(place.added)
    const age = now - Date.parse(place.added)
    return (Number.isNaN(tiles) || inOsm > tiles) && age < (noted ? NOTE_KEEP_DAYS : KEEP_DAYS) * DAY
  })
}
