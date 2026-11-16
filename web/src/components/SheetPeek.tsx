import type { ReactNode } from 'react'
import type { CollisionFilters, CollisionSpot } from '../collisions'
import { useI18n } from '../i18n'
import {
  type BasemapId,
  type LayerId,
  LTS_COLORS,
  lampColor,
  pathwayColors,
  reachRamp,
  WINTER_COLORS,
  widthGradient,
} from '../layers'
import type { PathwayFilters } from '../pathways'
import type { PlaceKind } from '../places'
import { distanceByPart, partLook, ROUTE_PARTS, type RouteView } from '../route/breakdown'
import type { Route } from '../route/brouter'
import type { Travel } from '../route/styles'
import { PlaceIcon } from './PlaceIcon'

/** A bar of coloured parts, as wide as the line it is on. */
function Bar({ parts }: { parts: [color: string, size: number][] }) {
  return (
    <span className="peek-bar" aria-hidden="true">
      {parts.map(([color, size], i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: parts never move
        <span key={i} style={{ flexGrow: size, background: color }} />
      ))}
    </span>
  )
}

function Swatch({
  color,
  dashed = false,
  dot = false,
  glow = false,
}: {
  color: string
  dashed?: boolean
  dot?: boolean
  glow?: boolean
}) {
  const className = `swatch ${dot ? 'lamp' : 'line'} ${dashed ? 'dashed' : ''} ${glow ? 'glow' : ''}`
  return <span className={className} style={{ color, background: dashed ? undefined : color }} />
}

interface LayerProps {
  layer: LayerId
  basemap: BasemapId
  placeKinds: readonly PlaceKind[]
  collisionSpots: readonly CollisionSpot[] | null
  collisionFilters: CollisionFilters
  pathwayFilters: PathwayFilters
}

/** The active layer's key, small enough for one line. */
export function LayerPeek({
  layer,
  basemap,
  placeKinds,
  collisionSpots,
  collisionFilters,
  pathwayFilters,
}: LayerProps): ReactNode {
  const { t, lang } = useI18n()
  if (layer === 'pathways') {
    const colors = pathwayColors(basemap)
    const bySurface = pathwayFilters.by === 'surface'
    return (
      <>
        <span>{t(bySurface ? 'surface.paved' : 'pathways.narrow')}</span>
        {bySurface ? (
          <Bar parts={Object.values(colors.surface).map((color) => [color, 1])} />
        ) : (
          <span className="peek-bar" aria-hidden="true" style={{ background: widthGradient(basemap) }} />
        )}
        <span>{t(bySurface ? 'surface.dirt' : 'pathways.wide')}</span>
        <span className="peek-item">
          <Swatch color={colors.unknown} />
          {t('unknown')}
        </span>
      </>
    )
  }
  if (layer === 'comfort')
    return (
      <>
        <span>{t('peek.lowStress')}</span>
        <Bar parts={LTS_COLORS.map((color) => [color, 1])} />
        <span>{t('peek.highStress')}</span>
      </>
    )
  if (layer === 'winter')
    return (['yes', 'no', 'unknown'] as const).map((value) => (
      <span key={value} className="peek-item">
        <Swatch color={WINTER_COLORS[value]} dashed={value === 'unknown'} />
        {t(`winter.${value}`)}
      </span>
    ))
  if (layer === 'night') {
    const lamp = lampColor(basemap)
    return (
      <>
        <span className="peek-item">
          <Swatch color={lamp} glow />
          {t('night.street')}
        </span>
        <span className="peek-item">
          <Swatch color={lamp} dot />
          {t('night.lamp')}
        </span>
      </>
    )
  }
  if (layer === 'collisions') {
    if (!collisionSpots) return null
    const { from, to, severities } = collisionFilters
    const count = collisionSpots.reduce(
      (sum, spot) => sum + spot.items.filter((item) => severities.includes(item.severity)).length,
      0,
    )
    const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
    const shown = t('crash.shown').replace('{count}', number(count)).replace('{spots}', number(collisionSpots.length))
    return <span className="peek-text">{`${shown} · ${from === to ? from : `${from}–${to}`}`}</span>
  }
  if (!placeKinds.length) return <span className="peek-text">{t('peek.noPlaces')}</span>
  return placeKinds.map((kind) => <PlaceIcon key={kind} kind={kind} />)
}

/** How the route splits by what the route card shows, as a thin bar. */
export function RoutePeek({ route, travel, view }: { route: Route; travel: Travel; view: RouteView }): ReactNode {
  if (travel !== 'bike') return null
  const totals = distanceByPart(route, view)
  const parts = ROUTE_PARTS[view]
    .filter((key) => (totals.get(key) ?? 0) > 0)
    .map((key): [string, number] => [partLook(view, key).color, totals.get(key) ?? 0])
  return <Bar parts={parts} />
}

/** The reach map's colours, from the start to the time limit. */
export function ReachPeek({ minutes, basemap }: { minutes: number; basemap: BasemapId }): ReactNode {
  const ramp = reachRamp(basemap)
  return (
    <>
      <span>0</span>
      <span
        className="peek-bar"
        aria-hidden="true"
        style={{ background: `linear-gradient(to right, ${ramp.join(', ')})` }}
      />
      <span>{minutes} min</span>
    </>
  )
}
