/** Map image name of a closure on the roadwork overlay. */
export const CLOSURE_IMAGE = 'closure'

export const CONSTRUCTION_ORANGE = '#EE6A1C'
export const CONSTRUCTION_DARK = '#1E2A30'

/** Roadwork: a traffic cone in the 20-unit square every drawing of it uses: the cone, its white band, its base. */
export const CONE = {
  body: [
    [10, 2],
    [15.5, 16],
    [4.5, 16],
  ],
  band: [
    [7.6, 8.2],
    [12.4, 8.2],
    [13.4, 10.8],
    [6.6, 10.8],
  ],
  base: { x: 2.5, y: 16, width: 15, height: 2.5 },
}

/** Projects: a barricade, a board in orange and white stripes on two legs, in the same square. */
export const BARRICADE = {
  board: { x: 2, y: 4, width: 16, height: 7 },
  stripes: [2, 6.75, 11.5].map((x) => [
    [x, 11],
    [x + 2.5, 11],
    [x + 6.5, 4],
    [x + 4, 4],
  ]),
  legs: [
    { x: 4.5, y: 11, width: 2, height: 6.5 },
    { x: 13.5, y: 11, width: 2, height: 6.5 },
  ],
}

/** Marker size in CSS pixels, and how much sharper than that it is drawn. */
const SIZE = 22
const PIXEL_RATIO = 2

/** A closure's cone for the map, ringed in white so it shows on any ground. The switch draws it in SVG. */
export function renderClosureImage(): { image: ImageData; pixelRatio: number } | null {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = SIZE * PIXEL_RATIO
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.scale(PIXEL_RATIO, PIXEL_RATIO)
  ctx.translate(1, 1)
  const polygon = (points: number[][]) => {
    ctx.beginPath()
    for (const [x, y] of points) ctx.lineTo(x, y)
    ctx.closePath()
  }
  const { x, y, width, height } = CONE.base
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = 3
  polygon(CONE.body)
  ctx.stroke()
  ctx.strokeRect(x, y, width, height)
  ctx.fillStyle = CONSTRUCTION_ORANGE
  polygon(CONE.body)
  ctx.fill()
  ctx.fillStyle = '#FFFFFF'
  polygon(CONE.band)
  ctx.fill()
  ctx.fillStyle = CONSTRUCTION_DARK
  ctx.fillRect(x, y, width, height)
  return { image: ctx.getImageData(0, 0, canvas.width, canvas.height), pixelRatio: PIXEL_RATIO }
}
