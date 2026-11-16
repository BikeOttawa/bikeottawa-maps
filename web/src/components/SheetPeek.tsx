import type { ReactNode } from 'react'
import type { CollisionFilters, CollisionSpot } from '../collisions'
import { COMFORT_GROUPS, type ComfortFilters, comfortColorBy } from '../comfort'
import { CONSTRUCTION_TIMINGS } from '../construction'
import { useI18n } from '../i18n'
import {
  type BasemapId,
  comfortSetColors,
  constructionColors,
  type LayerId,
  LTS_COLORS,
  pathwaySetColors,
  reachRamp,
} from '../layers'
import { colorBy, PATHWAY_GROUPS, type PathwayFilters } from '../pathways'
import type { PlaceKind } from '../places'
import { distanceByPart, partLook, ROUTE_PARTS, type RouteView } from '../route/breakdown'
import type { Route } from '../route/brouter'
import type { Travel } from '../route/styles'
import type { TheftFilters, TheftSpot } from '../thefts'
import { labelKey as comfortLabelKey } from './ComfortLegend'
import { labelKey } from './PathwayLegend'
import { PlaceIcon } from './PlaceIcon'

/** The pathways' surfaces from paved to ground, as their peek bar. */
const PAVED_TO_GROUND = ['asphalt', 'concrete', 'paving_stones', 'fine_gravel', 'gravel', 'ground'] as const

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

function Swatch({ color }: { color: string }) {
  return <span className="swatch line" style={{ background: color }} />
}

interface LayerProps {
  layer: LayerId
  basemap: BasemapId
  placeKinds: readonly PlaceKind[]
  collisionSpots: readonly CollisionSpot[] | null
  collisionFilters: CollisionFilters
  theftSpots: readonly TheftSpot[] | null
  theftFilters: TheftFilters
  pathwayFilters: PathwayFilters
  comfortFilters: ComfortFilters
}

/** The active layer's key, small enough for one line. */
export function LayerPeek({
  layer,
  basemap,
  placeKinds,
  collisionSpots,
  collisionFilters,
  theftSpots,
  theftFilters,
  pathwayFilters,
  comfortFilters,
}: LayerProps): ReactNode {
  const { t, lang } = useI18n()
  if (layer === 'pathways') {
    // The colours of the row the map is coloured by, first to last, then not tagged.
    const by = colorBy(pathwayFilters)
    const colors = pathwaySetColors(basemap)[by]
    const all: readonly string[] = PATHWAY_GROUPS[by]
    const groups = by === 'surface' ? PAVED_TO_GROUND : all.filter((group) => group !== 'unknown')
    return (
      <>
        <span>{t(labelKey(by, groups[0]))}</span>
        <Bar parts={groups.map((group) => [colors[group], 1])} />
        <span>{t(labelKey(by, groups[groups.length - 1]))}</span>
        {all.includes('unknown') && (
          <span className="peek-item">
            <Swatch color={colors.unknown} />
            {t('unknown')}
          </span>
        )}
      </>
    )
  }
  if (layer === 'comfort') {
    const by = comfortColorBy(comfortFilters)
    if (by === 'stress')
      return (
        <>
          <span>{t('peek.lowStress')}</span>
          <Bar parts={LTS_COLORS.map((color) => [color, 1])} />
          <span>{t('peek.highStress')}</span>
        </>
      )
    // The colours of the open row, first to last, then not tagged.
    const colors = comfortSetColors()[by]
    const all: readonly string[] = COMFORT_GROUPS[by]
    const groups = all.filter((group) => group !== 'unknown' && group !== 'other')
    return (
      <>
        <span>{t(comfortLabelKey(by, groups[0]))}</span>
        <Bar parts={groups.map((group) => [colors[group], 1])} />
        <span>{t(comfortLabelKey(by, groups[groups.length - 1]))}</span>
        {all.includes('unknown') && (
          <span className="peek-item">
            <Swatch color={colors.unknown} />
            {t('unknown')}
          </span>
        )}
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
  if (layer === 'construction') {
    const colors = constructionColors(basemap)
    return (
      <>
        <span>{t('construction.peek.now')}</span>
        <Bar parts={CONSTRUCTION_TIMINGS.map((timing) => [colors[timing], 1])} />
        <span>{t('construction.peek.later')}</span>
      </>
    )
  }
  if (layer === 'thefts') {
    if (!theftSpots) return null
    const { from, to } = theftFilters
    const count = theftSpots.reduce((sum, spot) => sum + spot.items.length, 0)
    const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
    const shown = t('theft.shown').replace('{count}', number(count)).replace('{spots}', number(theftSpots.length))
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
