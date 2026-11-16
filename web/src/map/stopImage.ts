import type { StopKind } from '../route/brouter'

/** Marker size in CSS pixels, and how much sharper than that it is drawn. */
const SIZE = 20
const PIXEL_RATIO = 2

export const STOP_RED = '#C8281B'
export const LIGHT_BODY = '#1E2A30'
export const LIGHT_COLORS = ['#E5483B', '#F2B632', '#3DB55C']

/**
 * A barrier is two bollards with a gap between them: in the way, but most let a
 * bike through. In the 20-unit square both drawings use.
 */
export const BOLLARD_XS = [3.5, 12] as const
export const BOLLARD = { y: 3.5, width: 4.5, height: 13, radius: 2.25, bandY: 6.5, bandHeight: 2.5 }
export const GROUND = { x1: 1.5, x2: 18.5, y: 17.5 }

/** A small stop sign, traffic light or barrier for the map. The legend draws the same shapes in SVG. */
export function renderStopImage(kind: StopKind): { image: ImageData; pixelRatio: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  const centre = SIZE / 2
  ctx.lineWidth = 1.5
  ctx.strokeStyle = '#FFFFFF'

  if (kind === 'stop') {
    // An octagon with a white rim.
    ctx.beginPath()
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 4) * (i + 0.5)
      ctx.lineTo(centre + Math.cos(angle) * 8.5, centre + Math.sin(angle) * 8.5)
    }
    ctx.closePath()
    ctx.fillStyle = STOP_RED
    ctx.fill()
    ctx.stroke()
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(centre - 4.5, centre - 1.25, 9, 2.5)
  } else if (kind === 'barrier') {
    // Ringed in white first, so the posts and the ground show on any map.
    const { y, width, height, radius, bandY, bandHeight } = BOLLARD
    const ground = () => {
      ctx.beginPath()
      ctx.moveTo(GROUND.x1, GROUND.y)
      ctx.lineTo(GROUND.x2, GROUND.y)
      ctx.stroke()
    }
    ctx.lineCap = 'round'
    ctx.lineWidth = 3
    ground()
    for (const x of BOLLARD_XS) {
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, radius)
      ctx.stroke()
    }
    ctx.strokeStyle = LIGHT_BODY
    ctx.lineWidth = 1.5
    ground()
    for (const x of BOLLARD_XS) {
      ctx.beginPath()
      ctx.roundRect(x, y, width, height, radius)
      ctx.fillStyle = LIGHT_BODY
      ctx.fill()
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(x, bandY, width, bandHeight)
    }
  } else {
    // A dark housing with red, amber and green lamps.
    ctx.beginPath()
    ctx.roundRect(centre - 4.5, 1, 9, 18, 3)
    ctx.fillStyle = LIGHT_BODY
    ctx.fill()
    ctx.stroke()
    LIGHT_COLORS.forEach((color, i) => {
      ctx.beginPath()
      ctx.arc(centre, 4.8 + i * 5.2, 2, 0, Math.PI * 2)
      ctx.fillStyle = color
      ctx.fill()
    })
  }
  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: PIXEL_RATIO }
}
