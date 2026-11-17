import type { ExpressionSpecification } from 'maplibre-gl'

/** Zoom from which collisions and thefts show as spots; further out they make a heat map. */
export const SPOTS_FROM = 12.5

/** Zoom from which spots have their full size. */
const SPOTS_FULL = 17

/**
 * A spot's radius in pixels where spots first show and at full size: one
 * item's, and the busiest spot's, so the busiest are as big on every layer.
 */
const RADIUS = { first: { one: 3.75, most: 12.5 }, full: { one: 7.5, most: 30 } } as const
type Radius = (typeof RADIUS)[keyof typeof RADIUS]

/** Spots are sized against the busiest, taken as at least this many items, so a handful never makes a big spot. */
const BUSIEST_AT_LEAST = 10

/** Merged spots can hold more than the busiest; they grow past it up to this. */
const MERGED_AT_MOST = 1.5

/** Zoom up to which spots that would overlap are merged into one. */
export const MERGED_UNTIL = 14

/** How close spots are merged, in pixels. */
export const MERGE_RADIUS = 24

/** How many groups a legend row has at most: a spot carries its counts as `p0` to `p5`. */
export const MAX_GROUPS = 6

/** A spot's `scale`, for the busiest: its count less one times this is its size squared. */
export function spotScale(busiest: number): number {
  return 1 / (Math.max(busiest, BUSIEST_AT_LEAST) - 1)
}

/**
 * How big a spot is, from one item (0) to the busiest (1): the square root
 * of its count, so area follows the count.
 */
export function spotSize(count: number, busiest: number): number {
  return Math.sqrt(Math.max(0, count - 1) * spotScale(busiest))
}

/** The same on the map, where merged spots add up their counts. */
const size: ExpressionSpecification = [
  'min',
  MERGED_AT_MOST,
  ['sqrt', ['*', ['max', 0, ['-', ['get', 'count'], 1]], ['get', 'scale']]],
]

/**
 * What merged spots add up: their counts, each group's, and whatever else
 * the layer colours them by; the scale they share.
 */
export function mergedProperties(extra: Record<string, ExpressionSpecification> = {}): Record<string, unknown> {
  return {
    count: ['+', ['get', 'count']],
    scale: ['max', ['get', 'scale']],
    ...Object.fromEntries(
      Array.from({ length: MAX_GROUPS }, (_, i) => [`p${i}`, ['+', ['coalesce', ['get', `p${i}`], 0]]]),
    ),
    ...extra,
  }
}

/** A row's colour for the group most of a spot's items fall in; on a tie, the one listed first. */
export function mostCommon(colors: readonly string[]): ExpressionSpecification {
  const p = (i: number): ExpressionSpecification => ['get', `p${i}`]
  const branches = colors.flatMap((color, i) => [
    ['all', ...colors.flatMap((_, j) => (j === i ? [] : [[j < i ? '>' : '>=', p(i), p(j)]]))],
    color,
  ])
  return ['case', ...branches, colors[0]] as unknown as ExpressionSpecification
}

/** The smallest radius at which a spot shows its split as a pie: slices of smaller ones would not read. */
const PIE_MIN_RADIUS = 6

/** The ring around each spot and the lines between its slices, in pixels at full size. */
const RING = 1.5
const SEPARATOR = 1

/** How much sharper than CSS pixels pies are drawn. */
const PIXEL_RATIO = 2

export const PIE_PREFIX = 'pie:'

function radiusExpression({ one, most }: Radius): ExpressionSpecification {
  return ['+', one, ['*', most - one, size]]
}

/** A pie's radius at full size, in whole pixels: it is drawn that big. */
const pieRadius: ExpressionSpecification = ['round', radiusExpression(RADIUS.full)]

/** A spot's radius, growing with the zoom and its count. */
export const spotRadius: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  SPOTS_FROM,
  radiusExpression(RADIUS.first),
  SPOTS_FULL,
  radiusExpression(RADIUS.full),
]

/** How much a pie, drawn at full size, is scaled to match its spot. */
export const pieSize: ExpressionSpecification = [
  'interpolate',
  ['linear'],
  ['zoom'],
  SPOTS_FROM,
  ['/', radiusExpression(RADIUS.first), pieRadius],
  SPOTS_FULL,
  ['/', radiusExpression(RADIUS.full), pieRadius],
]

/**
 * The smallest `size` a spot needs to be drawn as a pie at a zoom: PIE_MIN_RADIUS
 * at that zoom's smallest. Filters see whole zooms only, so this steps at each.
 */
export function pieMinSize(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - SPOTS_FROM) / (SPOTS_FULL - SPOTS_FROM)))
  const at = (key: 'one' | 'most') => RADIUS.first[key] + t * (RADIUS.full[key] - RADIUS.first[key])
  return Math.max(0, (PIE_MIN_RADIUS - at('one')) / (at('most') - at('one')))
}

/** Whether a spot is drawn as a pie at the zoom its tile was made for: one of two or more items, big enough. */
export const isPie: ExpressionSpecification = [
  'all',
  ['>', ['get', 'count'], 1],
  [
    '>=',
    size,
    [
      'step',
      ['zoom'],
      pieMinSize(Math.floor(SPOTS_FROM)),
      ...Array.from({ length: SPOTS_FULL - Math.floor(SPOTS_FROM) }, (_, i) => {
        const zoom = Math.floor(SPOTS_FROM) + i + 1
        return [zoom, pieMinSize(zoom)]
      }).flat(),
    ],
  ],
]

/** The image of a spot's pie: its ring, its groups' colours in order, their counts in the same order, and its radius. */
export function pieImage(colors: readonly string[], ring: string): ExpressionSpecification {
  const counts = colors.flatMap((_, i) => [...(i ? [','] : []), ['to-string', ['get', `p${i}`]]])
  return [
    'concat',
    `${PIE_PREFIX}${ring}:${colors.join(',')}:`,
    ...counts,
    ':',
    ['to-string', pieRadius],
  ] as unknown as ExpressionSpecification
}

/** A spot's pie for the map, at its full size: a slice per group from the top, clockwise, ringed to stand apart. */
export function renderPieImage(id: string): { image: ImageData; pixelRatio: number } | null {
  const [ring, colorList, countList, radius] = id.slice(PIE_PREFIX.length).split(':')
  const colors = colorList?.split(',') ?? []
  const counts = countList?.split(',').map(Number) ?? []
  const total = counts.reduce((sum, n) => sum + n, 0)
  const r = Number(radius)
  if (!ring || !total || !(r > 0) || counts.length !== colors.length || counts.some((n) => !(n >= 0))) return null
  const size = Math.ceil(2 * (r + RING) + 2)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  const c = size / 2
  ctx.fillStyle = ring
  ctx.beginPath()
  ctx.arc(c, c, r + RING, 0, 2 * Math.PI)
  ctx.fill()
  const edges: number[] = []
  let start = -Math.PI / 2
  counts.forEach((n, i) => {
    if (!n) return
    const end = start + (2 * Math.PI * n) / total
    ctx.fillStyle = colors[i]
    ctx.beginPath()
    ctx.moveTo(c, c)
    ctx.arc(c, c, r, start, end)
    ctx.closePath()
    ctx.fill()
    edges.push(start)
    start = end
  })
  if (edges.length > 1) {
    ctx.strokeStyle = ring
    ctx.lineWidth = SEPARATOR
    ctx.beginPath()
    for (const a of edges) {
      ctx.moveTo(c, c)
      ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a))
    }
    ctx.stroke()
  }
  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: PIXEL_RATIO }
}
