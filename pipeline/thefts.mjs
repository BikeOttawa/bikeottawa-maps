// Helpers for fetch-thefts.mjs: which of the police's bike records are thefts,
// and their details in the map's terms.

/** Bikes stolen, and stolen bikes since recovered. Found, seized and disposed-of bikes are not thefts. */
export const THEFT_STATUSES = ['Stolen', 'Recovered']

/** E-scooters are in the data too; the map is about bikes. */
export const NOT_A_BIKE = ['Escooter (Esc)']

/**
 * Where the bike was taken from, by the offence: a theft (most often locked up
 * outdoors), a break-in at a home, or one at another building (garages, storage
 * rooms, shops).
 * @param {string | null | undefined} offence
 */
export function takenFrom(offence) {
  const text = String(offence ?? '')
  if (/^B&E Residence/.test(text)) return 'home'
  if (/^B&E Non/.test(text)) return 'building'
  if (/^Theft[<>] Bicycle/.test(text)) return 'outdoors'
  return 'other'
}

const TYPES = { Mountain: 'mountain', Hybrid: 'hybrid', Racer: 'road', Touring: 'road', Regular: 'city' }

/** Mountain, hybrid, road, city or a child's bike; anything else is other. */
export function bikeType(type, style) {
  if (style === "Child's") return 'kids'
  return TYPES[type] ?? 'other'
}

const UNKNOWN_MAKES = new Set(['UNKNOWN', 'UNK', 'NODA', 'NODATA', 'OTHER', 'NONE', 'N/A', ''])

/**
 * Makes as written once cleaned: the police often cut them to four letters
 * (GIAN, NORC), so a short one becomes the longer make it most often stands
 * for. Returns a function from a record's make to its name, or undefined.
 * @param {(string | null | undefined)[]} makes every make in the data
 */
export function makeNamer(makes) {
  const counts = new Map()
  for (const make of makes) {
    const key = String(make ?? '')
      .trim()
      .toUpperCase()
    if (!UNKNOWN_MAKES.has(key)) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const full = new Map()
  for (const key of counts.keys()) {
    if (key.length !== 4) continue
    let best = null
    for (const [other, n] of counts) {
      if (other.length > 4 && other.startsWith(key) && (!best || n > counts.get(best))) best = other
    }
    if (best) full.set(key, best)
  }
  return (make) => {
    const key = String(make ?? '')
      .trim()
      .toUpperCase()
    if (UNKNOWN_MAKES.has(key)) return undefined
    const name = full.get(key) ?? key
    // Short names are initials (CCM, GT, MEC); longer ones read better in title case.
    return name.length <= 3
      ? name
      : name.toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase())
  }
}

/** The day in Ottawa of a time in milliseconds, as YYYY-MM-DD. */
export function ottawaDay(ms) {
  return new Date(ms).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
}
