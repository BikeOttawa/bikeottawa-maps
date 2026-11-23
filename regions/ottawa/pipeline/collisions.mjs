// Helpers for fetch-collisions.mjs.

/** Metres between two [lon, lat] points, near enough over a few hundred metres. */
function metres([lon1, lat1], [lon2, lat2]) {
  const x = (lon2 - lon1) * 111320 * Math.cos((lat1 * Math.PI) / 180)
  const y = (lat2 - lat1) * 110540
  return Math.hypot(x, y)
}

/** Fields that differ between copies of one collision. */
const OWN = ['ID', 'Lat', 'Long']

/**
 * The records left once copies are dropped: the city's data lists a few
 * collisions twice, the same in every field but the record id, with points up
 * to a few metres apart. The first is kept.
 * @param {Record<string, unknown>[]} rows the city's records, with Lat and Long
 */
export function withoutCopies(rows, within = 25) {
  /** Points kept so far, by every other field. */
  const kept = new Map()
  return rows.filter((row) => {
    const key = JSON.stringify(Object.entries(row).filter(([k]) => !OWN.includes(k)))
    const at = [row.Long, row.Lat]
    const points = kept.get(key) ?? []
    if (points.some((point) => metres(point, at) <= within)) return false
    kept.set(key, [...points, at])
    return true
  })
}
