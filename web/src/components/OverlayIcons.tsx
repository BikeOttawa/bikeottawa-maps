import { bikewayColors, LAMP_COLOR_ON_PALE, ROUTE_COLORS, routeBandColors, wardColors } from '../layers'
import { BARRICADE, CONE, CONSTRUCTION_DARK, CONSTRUCTION_ORANGE } from '../map/closureImage'

/** Roadwork: a traffic cone, as the map draws each closure. */
export function ConeIcon({ size = 18 }: { size?: number }) {
  const { x, y, width, height } = CONE.base
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20">
      <polygon points={CONE.body.join(' ')} fill={CONSTRUCTION_ORANGE} />
      <polygon points={CONE.band.join(' ')} fill="#fff" />
      <rect x={x} y={y} width={width} height={height} fill={CONSTRUCTION_DARK} />
    </svg>
  )
}

/** Projects: a barricade, for the layer's tile. */
export function BarricadeIcon({ size = 18 }: { size?: number }) {
  const { board, stripes, legs } = BARRICADE
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 20 20">
      {legs.map((leg) => (
        <rect key={leg.x} {...leg} fill={CONSTRUCTION_DARK} />
      ))}
      <rect {...board} fill="#fff" />
      {stripes.map((points) => (
        <polygon key={points[0][0]} points={points.join(' ')} fill={CONSTRUCTION_ORANGE} />
      ))}
      <rect {...board} fill="none" stroke={CONSTRUCTION_DARK} strokeWidth="1" />
    </svg>
  )
}

/** Street lights: a lamp on its post, its light spreading below. */
export function LampIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round">
      <path d="M12 9.5 17.5 21h-11Z" fill={LAMP_COLOR_ON_PALE} fillOpacity="0.25" />
      <path d="M5 21V5.5A2.5 2.5 0 0 1 7.5 3H12v3" stroke="#34404A" strokeWidth="2" />
      <path
        d="M9.5 6.5h5L12 9.5Z"
        fill={LAMP_COLOR_ON_PALE}
        stroke={LAMP_COLOR_ON_PALE}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Bike lanes: a bicycle in the overlay's green. */
export function LanesIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={bikewayColors('light').dedicated}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="5.5" cy="16" r="4" />
      <circle cx="18.5" cy="16" r="4" />
      <path d="M5.5 16 9 8h6l3.5 8M9 8l3.5 8h-7M8 5h3" />
    </svg>
  )
}

/** Bike routes: a signed route's soft band winding across, in the regional routes' colour. */
export function RoutesIcon({ size = 18 }: { size?: number }) {
  const path = 'M3 18c5 0 4-6 9-6s4-7 9-7'
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" strokeLinecap="round">
      <path d={path} stroke={routeBandColors('light').regional} strokeWidth="6" />
      <path d={path} stroke={ROUTE_COLORS.regional} strokeWidth="2" />
    </svg>
  )
}

/** Wards: a ward's dashed boundary, in Ottawa's plum. */
export function WardsIcon({ size = 18 }: { size?: number }) {
  const { ottawa } = wardColors('light')
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M4 7 11 3.5l9 3-1 10.5-8.5 3.5L3.5 15Z"
        fill={ottawa}
        fillOpacity="0.15"
        stroke={ottawa}
        strokeWidth="2"
        strokeDasharray="3.5 2.5"
        strokeLinejoin="round"
      />
    </svg>
  )
}
