import type { ExpressionSpecification } from 'maplibre-gl'

/** Zoom from which collisions and thefts show as spots; further out they make a heat map. */
export const SPOTS_FROM = 12.5

/** Zoom from which spots have their full size. */
const SPOTS_FULL = 17

/**
 * A spot's radius in pixels where spots first show and at full size: one
 * item's, then growing with the square root of the rest, so area follows the count.
 */
const RADIUS = { first: { one: 3, step: 1.4 }, full: { one: 6, step: 3 } } as const
type Radius = (typeof RADIUS)[keyof typeof RADIUS]

/** The smallest radius at which a spot shows its split as a pie: slices of smaller ones would not read. */
const PIE_MIN_RADIUS = 7

/** The ring around each spot and the lines between its slices, in pixels at full size. */
const RING = 1.5
const SEPARATOR = 1

/** How much sharper than CSS pixels pies are drawn. */
const PIXEL_RATIO = 2

export const PIE_PREFIX = 'pie:'

function radiusOf(count: number, { one, step }: Radius): number {
  return one + step * Math.sqrt(Math.max(0, count - 1))
}

function radiusExpression({ one, step }: Radius): ExpressionSpecification {
  return ['+', one, ['*', step, ['sqrt', ['-', ['get', 'count'], 1]]]]
}

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
  ['/', radiusExpression(RADIUS.first), radiusExpression(RADIUS.full)],
  SPOTS_FULL,
  1,
]

/**
 * The fewest items a spot needs to be drawn as a pie at a zoom: as many as
 * make it PIE_MIN_RADIUS across at that zoom's smallest. Filters see whole
 * zooms only, so this steps at each.
 */
export function pieMinCount(zoom: number): number {
  const t = Math.min(1, Math.max(0, (zoom - SPOTS_FROM) / (SPOTS_FULL - SPOTS_FROM)))
  const at = (key: 'one' | 'step') => RADIUS.first[key] + t * (RADIUS.full[key] - RADIUS.first[key])
  const n = ((PIE_MIN_RADIUS - at('one')) / at('step')) ** 2 + 1
  return Math.max(2, Math.ceil(n - 1e-9))
}

/** Whether a spot is drawn as a pie at the zoom its tile was made for. */
export const isPie: ExpressionSpecification = [
  '>=',
  ['get', 'count'],
  [
    'step',
    ['zoom'],
    pieMinCount(Math.floor(SPOTS_FROM)),
    ...Array.from({ length: SPOTS_FULL - Math.floor(SPOTS_FROM) }, (_, i) => {
      const zoom = Math.floor(SPOTS_FROM) + i + 1
      return [zoom, pieMinCount(zoom)]
    }).flat(),
  ],
]

/** The image of a spot's pie: its ring, its groups' colours in order, and its `pie` counts in the same order. */
export function pieImage(colors: readonly string[], ring: string): ExpressionSpecification {
  return ['concat', `${PIE_PREFIX}${ring}:${colors.join(',')}:`, ['get', 'pie']]
}

/** A spot's pie for the map, at its full size: a slice per group from the top, clockwise, ringed to stand apart. */
export function renderPieImage(id: string): { image: ImageData; pixelRatio: number } | null {
  const [ring, colorList, countList] = id.slice(PIE_PREFIX.length).split(':')
  const colors = colorList?.split(',') ?? []
  const counts = countList?.split(',').map(Number) ?? []
  const total = counts.reduce((sum, n) => sum + n, 0)
  if (!ring || !total || counts.length !== colors.length || counts.some((n) => !(n >= 0))) return null
  const r = radiusOf(total, RADIUS.full)
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
