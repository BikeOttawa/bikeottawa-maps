// Helpers for fetch-wards.mjs: Ottawa's councillor list, Gatineau's district
// names, lighter boundaries and a spot inside each ward for its label.

const clean = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Ward number → councillor, from the City of Ottawa's elected officials table.
 * A ward that changed hands mid-term has a row per councillor, the current one
 * marked "to present" in its ward name; otherwise the last row counts.
 * @param {Record<string, unknown>[]} rows
 * @returns {Map<number, string>}
 */
export function ottawaCouncillors(rows) {
  const byWard = new Map()
  for (const row of [...rows].sort((a, b) => Number(a.ObjectId) - Number(b.ObjectId))) {
    const ward = Number(row.Ward_number)
    if (!ward || row.Primary_Role !== 'Councillor') continue
    const current = /present/i.test(String(row.Ward_name ?? ''))
    const known = byWard.get(ward)
    if (known?.current && !current) continue
    byWard.set(ward, { name: clean(`${row.First_name} ${row.Last_name}`), current })
  }
  return new Map([...byWard].map(([ward, { name }]) => [ward, name]))
}

/** "de la Rivière-Blanche" → "Rivière-Blanche": Gatineau's district names without their article. */
export function districtName(name) {
  return clean(name).replace(/^(de la |de l'|du |des |de |d')/i, '')
}

/** Distance in degrees from a point to a segment, longitude scaled to match latitude. */
function segmentDistance([px, py], [ax, ay], [bx, by], kx) {
  const [dx, dy] = [(bx - ax) * kx, by - ay]
  const [qx, qy] = [(px - ax) * kx, py - ay]
  const t = dx || dy ? Math.max(0, Math.min(1, (qx * dx + qy * dy) / (dx * dx + dy * dy))) : 0
  return Math.hypot(qx - t * dx, qy - t * dy)
}

/** Douglas–Peucker on a closed ring, keeping its first and last points. */
export function simplifyRing(ring, tolerance) {
  if (ring.length <= 4) return ring
  const kx = Math.cos((ring[0][1] * Math.PI) / 180)
  const keep = new Uint8Array(ring.length)
  keep[0] = keep[ring.length - 1] = 1
  const stack = [[0, ring.length - 1]]
  while (stack.length) {
    const [first, last] = stack.pop()
    let worst = -1
    let at = 0
    for (let i = first + 1; i < last; i++) {
      const d = segmentDistance(ring[i], ring[first], ring[last], kx)
      if (d > worst) [worst, at] = [d, i]
    }
    if (worst > tolerance) {
      keep[at] = 1
      stack.push([first, at], [at, last])
    }
  }
  const out = ring.filter((_, i) => keep[i])
  return out.length >= 4 ? out : ring
}

const round = ([x, y]) => [Math.round(x * 1e5) / 1e5, Math.round(y * 1e5) / 1e5]

/** A polygon or multipolygon's rings simplified and rounded to about a metre. */
export function lighten(geometry, tolerance = 0.0001) {
  const polygon = (rings) => rings.map((ring) => simplifyRing(ring, tolerance).map(round))
  return geometry.type === 'Polygon'
    ? { type: 'Polygon', coordinates: polygon(geometry.coordinates) }
    : { type: 'MultiPolygon', coordinates: geometry.coordinates.map(polygon) }
}

function inside([x, y], rings) {
  let within = false
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i]
      const [xj, yj] = ring[j]
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) within = !within
    }
  }
  return within
}

function edgeDistance(point, rings, kx) {
  let best = Number.POSITIVE_INFINITY
  for (const ring of rings) {
    for (let i = 1; i < ring.length; i++) best = Math.min(best, segmentDistance(point, ring[i - 1], ring[i], kx))
  }
  return best
}

/**
 * Where a ward's label goes: the point of its largest part farthest from any
 * edge, found on a grid and then on a finer one around the best cell, so it
 * sits well inside even an odd-shaped ward.
 */
export function labelPoint(geometry) {
  const parts = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
  const area = (rings) => {
    let sum = 0
    const ring = rings[0]
    for (let i = 1; i < ring.length; i++) sum += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1]
    return Math.abs(sum)
  }
  const rings = parts.reduce((a, b) => (area(b) > area(a) ? b : a))
  const xs = rings[0].map((p) => p[0])
  const ys = rings[0].map((p) => p[1])
  const kx = Math.cos((((Math.min(...ys) + Math.max(...ys)) / 2) * Math.PI) / 180)
  let box = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  let best = { point: rings[0][0], distance: -1 }
  for (let pass = 0; pass < 2; pass++) {
    const [w, s, e, n] = box
    const steps = 40
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const point = [w + ((e - w) * i) / steps, s + ((n - s) * j) / steps]
        if (!inside(point, rings)) continue
        const distance = edgeDistance(point, rings, kx)
        if (distance > best.distance) best = { point, distance }
      }
    }
    const [cx, cy] = best.point
    const [hx, hy] = [(e - w) / steps, (n - s) / steps]
    box = [cx - hx, cy - hy, cx + hx, cy + hy]
  }
  return round(best.point)
}
