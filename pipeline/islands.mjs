// Pathways that join up, at a shared node or through a crossing, make one
// island; the pathways layer can then leave out islands too short to matter.
// Ways that share a node have the same coordinates in osmium's export.

const keyOf = (point) => `${point[0]},${point[1]}`

/** Crossings tie the pathways on either side of a street together. */
export function isCrossing(tags) {
  return tags.footway === 'crossing' || tags.cycleway === 'crossing' || tags.path === 'crossing'
}

/**
 * @returns {{
 *   add: (coords: number[][], metres: number) => void,
 *   length: (coords: number[][]) => number,
 * }} `add` joins a way's points into one island and counts its length (0 for
 *   a crossing, which only connects); `length` is the length of the island a
 *   way added before is part of.
 */
export function islandIndex() {
  const index = new Map()
  const parent = []
  const metres = []
  const find = (i) => {
    let at = i
    while (parent[at] !== at) {
      parent[at] = parent[parent[at]]
      at = parent[at]
    }
    return at
  }
  const idOf = (point) => {
    const key = keyOf(point)
    let id = index.get(key)
    if (id === undefined) {
      id = parent.length
      index.set(key, id)
      parent.push(id)
      metres.push(0)
    }
    return id
  }
  return {
    add(coords, length) {
      const root = find(idOf(coords[0]))
      for (let i = 1; i < coords.length; i++) {
        const other = find(idOf(coords[i]))
        if (other === root) continue
        parent[other] = root
        metres[root] += metres[other]
      }
      metres[root] += length
    },
    length(coords) {
      const id = index.get(keyOf(coords[0]))
      return id === undefined ? 0 : metres[find(id)]
    },
  }
}
