import { useMemo, useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { LTS_COLORS } from '../layers'
import { BOLLARD, BOLLARD_XS, GROUND, LIGHT_BODY, LIGHT_COLORS, STOP_RED } from '../map/stopImage'
import { distanceByPart, partLook, ROUTE_PARTS, ROUTE_VIEWS, type RouteView } from '../route/breakdown'
import { type Route, type RouteHighlight, STOP_KINDS, type StopKind } from '../route/brouter'
import { downloadText, toGpx } from '../route/gpx'
import { routeProfile, smoothElevation } from '../route/profile'
import { stressLevel, stressScore } from '../route/stress'
import type { Travel } from '../route/styles'
import type { RouteState } from '../route/useRoute'
import { visibleRoute } from '../route/useRoute'
import { ElevationChart } from './ElevationChart'
import { GroupRow } from './GroupBars'

/** What the legend needs to pick things out on the map: pointing shows them, a click keeps them and zooms there. */
interface Picking {
  /** The item currently picked out, by pointing or by a click. */
  highlight: RouteHighlight | null
  /** The item kept picked out by a click. */
  pinned: RouteHighlight | null
  onPoint: (item: RouteHighlight | null) => void
  onPin: (item: RouteHighlight | null) => void
}

function pickingProps(item: RouteHighlight, { pinned, onPoint, onPin }: Picking) {
  return {
    'aria-pressed': pinned === item,
    onPointerEnter: () => onPoint(item),
    onPointerLeave: () => onPoint(null),
    onFocus: () => onPoint(item),
    onBlur: () => onPoint(null),
    onClick: () => onPin(pinned === item ? null : item),
  }
}

const STOP_LABELS: Record<StopKind, MessageKey> = { stop: 'stopSigns', light: 'trafficLights', barrier: 'barriers' }

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

function StopIcon({ kind }: { kind: StopKind }) {
  if (kind === 'barrier') return <BarrierIcon />
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

/** Stop signs, traffic lights and barriers on the route, counted on one line. */
function StopCounts({ route, picking }: { route: Route; picking: Picking }) {
  const { t } = useI18n()
  return (
    <p className="stop-counts">
      {STOP_KINDS.map((kind) => {
        const count = route.stops.filter((stop) => stop.kind === kind).length
        return (
          <button
            key={kind}
            type="button"
            className="stop-count"
            title={kind === 'barrier' ? `${t('barriersHint')} ${t('showOnRoute')}` : t('showOnRoute')}
            disabled={count === 0}
            {...pickingProps(kind, picking)}
          >
            <StopIcon kind={kind} />
            {t(STOP_LABELS[kind])} <b>{count}</b>
          </button>
        )
      })}
    </p>
  )
}

/**
 * How the route splits by comfort, bike infrastructure, surface, lighting and
 * winter maintenance, a row each as in the legends: the open one colours the
 * route, comfort with none open. Pointing at a part picks it out on the map; a
 * click keeps it and zooms there.
 */
function Breakdown({
  route,
  view,
  onViewChange,
  picking,
}: {
  route: Route
  view: RouteView | null
  onViewChange: (view: RouteView | null) => void
  picking: Picking
}) {
  const { pinned, onPoint, onPin } = picking
  const { t } = useI18n()
  return (
    // The rows speak for themselves; the name stays for screen readers.
    <fieldset className="conditions" aria-label={t('routeAlong')}>
      {ROUTE_VIEWS.map((id) => {
        const metres = distanceByPart(route, id)
        const parts = ROUTE_PARTS[id]
        const open = id === view
        return (
          <GroupRow
            key={id}
            name={t(`routeView.${id}`)}
            groups={parts}
            counts={{ shown: metres, all: metres }}
            // Views share part names (lighting's and snow's "yes"), so only the open one shows the pin.
            picked={open && pinned && parts.includes(pinned) ? [pinned] : []}
            compared={false}
            color={(part) => partLook(id, part).color}
            pattern={(part) => partLook(id, part).pattern}
            label={(part) => t(partLook(id, part).label)}
            title={() => t('showOnRoute')}
            single
            onPick={(next) => onPin(next[0] ?? null)}
            onPoint={open ? onPoint : undefined}
            open={open}
            onToggle={() => onViewChange(open ? null : id)}
          />
        )
      })}
    </fieldset>
  )
}

interface Props {
  /** On foot, the cycling-only parts (comfort, stress, stops) are left out. */
  travel: Travel
  state: RouteState
  /** The row open on the card, which colours the route; none at first. */
  view: RouteView | null
  onViewChange: (view: RouteView | null) => void
  /** Metres along the route being pointed at, on the chart or on the map. */
  hover: number | null
  onHover: (distance: number | null) => void
  /** Legend item picked out on the map. */
  highlight: RouteHighlight | null
  pinned: RouteHighlight | null
  onPointPart: (item: RouteHighlight | null) => void
  onPinPart: (item: RouteHighlight | null) => void
}

export function RouteResult({
  travel,
  state,
  view,
  onViewChange,
  hover,
  onHover,
  highlight,
  pinned,
  onPointPart,
  onPinPart,
}: Props) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const route = visibleRoute(state)
  const picking: Picking = { highlight, pinned, onPoint: onPointPart, onPin: onPinPart }
  const profile = useMemo(() => (route ? smoothElevation(routeProfile(route.coords)) : []), [route])

  if (state.status === 'error') return <p className="route-message error">{t('routeError')}</p>
  if (!route) return <p className="route-message">{state.status === 'loading' ? t('routeLoading') : t('routeHint')}</p>

  const stress = stressScore(route.segments)

  const copyLink = () => {
    navigator.clipboard
      .writeText(window.location.href)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => setCopied(false))
  }

  return (
    <section className={`route-result ${state.status === 'loading' ? 'stale' : ''}`} aria-live="polite">
      <dl className="route-stats">
        <div className="route-stat">
          <dd>{(route.distance / 1000).toFixed(1)} km</dd>
          <dt>{t('distance')}</dt>
        </div>
        <div className="route-stat">
          <dd>{Math.max(1, Math.round(route.time / 60))} min</dd>
          <dt>{t('time')}</dt>
        </div>
        <div className="route-stat">
          <dd>{Math.round(route.ascent)} m</dd>
          <dt>{t('climb')}</dt>
        </div>
        {travel === 'bike' && (
          <div className="route-stat" title={t('stressAbout')}>
            <dd>
              <span
                className={`stress-score level-${stressLevel(stress)}`}
                style={{ background: LTS_COLORS[stressLevel(stress) - 1] }}
              >
                {stress}
                <span className="out-of">/10</span>
              </span>
            </dd>
            <dt>{t('stress')}</dt>
          </div>
        )}
      </dl>
      {travel === 'bike' && <Breakdown route={route} view={view} onViewChange={onViewChange} picking={picking} />}
      {travel === 'bike' && <StopCounts route={route} picking={picking} />}
      <ElevationChart profile={profile} label={t('elevation')} hover={hover} onHover={onHover} />
      <div className="route-actions">
        <button
          type="button"
          className="primary"
          onClick={() =>
            downloadText(
              `${travel === 'bike' ? 'bike' : 'walk'}-route.gpx`,
              toGpx(route, t(travel === 'bike' ? 'gpxName' : 'gpxNameWalk')),
              'application/gpx+xml',
            )
          }
        >
          {t('exportGpx')}
        </button>
        <button type="button" onClick={copyLink}>
          {copied ? t('copied') : t('copyLink')}
        </button>
      </div>
    </section>
  )
}
