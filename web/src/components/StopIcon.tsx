import { BOLLARD, BOLLARD_XS, GROUND, LIGHT_BODY, LIGHT_COLORS, STOP_RED } from '../map/stopImage'
import type { StopKind } from '../route/brouter'
import { ConeIcon } from './OverlayIcons'

/** The route card's stop sign, traffic light, barrier and roadwork, as the map draws them. */
function BarrierIcon() {
  const { y, width, height, radius, bandY, bandHeight } = BOLLARD
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
      <path d={`M${GROUND.x1} ${GROUND.y}H${GROUND.x2}`} stroke={LIGHT_BODY} strokeWidth="1.5" strokeLinecap="round" />
      {BOLLARD_XS.map((x) => (
        <g key={x}>
          <rect x={x} y={y} width={width} height={height} rx={radius} fill={LIGHT_BODY} />
          <rect x={x} y={bandY} width={width} height={bandHeight} fill="#fff" />
        </g>
      ))}
    </svg>
  )
}

export function StopIcon({ kind }: { kind: StopKind }) {
  if (kind === 'barrier') return <BarrierIcon />
  if (kind === 'roadwork') return <ConeIcon size={16} />
  return kind === 'stop' ? (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
      <path d="M6.5 1.5h7l5 5v7l-5 5h-7l-5-5v-7z" fill={STOP_RED} />
      <rect x="5.5" y="8.75" width="9" height="2.5" fill="#fff" />
    </svg>
  ) : (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 20 20">
      <rect x="5.5" y="1" width="9" height="18" rx="3" fill={LIGHT_BODY} />
      {LIGHT_COLORS.map((color, i) => (
        <circle key={color} cx="10" cy={4.8 + i * 5.2} r="2" fill={color} />
      ))}
    </svg>
  )
}
