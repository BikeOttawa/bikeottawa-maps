import type { Collision, CollisionFilters, CollisionSpot } from '../collisions'
import type { ComfortFilters, ComfortTotals } from '../comfort'
import type { ConstructionFilters, ConstructionProps } from '../construction'
import { useI18n } from '../i18n'
import type { BasemapId, LayerId } from '../layers'
import type { PathwayFilters, PathwayTotals } from '../pathways'
import { kindsInGroup, PLACE_GROUP_IDS, type PlaceKind } from '../places'
import type { Theft, TheftFilters, TheftSpot } from '../thefts'
import { CollisionLegend } from './CollisionLegend'
import { ComfortLegend } from './ComfortLegend'
import { ConstructionLegend } from './ConstructionLegend'
import { PathwayLegend } from './PathwayLegend'
import { PlaceIcon } from './PlaceIcon'
import { TheftLegend } from './TheftLegend'

interface Props {
  layer: LayerId
  comfortFilters: ComfortFilters
  onComfortFiltersChange: (filters: ComfortFilters) => void
  /** Km of the comfort layer by every combination of its bands; null where the tiles have none. */
  comfortTotals: ComfortTotals | null
  /** The collision spots shown, null while they load; and the most collisions at any one. */
  collisionSpots: readonly CollisionSpot[] | null
  /** Every collision, for the circumstances; null while they load. */
  collisions: readonly Collision[] | null
  busiestSpot: number
  collisionFilters: CollisionFilters
  onCollisionFiltersChange: (filters: CollisionFilters) => void
  /** The theft spots shown and every theft, null while they load; the most thefts at any one spot. */
  theftSpots: readonly TheftSpot[] | null
  thefts: readonly Theft[] | null
  busiestTheftSpot: number
  theftFilters: TheftFilters
  onTheftFiltersChange: (filters: TheftFilters) => void
  constructionFilters: ConstructionFilters
  onConstructionFiltersChange: (filters: ConstructionFilters) => void
  /** The construction projects, for the counts; null while they load. */
  projects: readonly ConstructionProps[] | null
  pathwayFilters: PathwayFilters
  onPathwayFiltersChange: (filters: PathwayFilters) => void
  /** Km of pathway by every combination of bands, from the pipeline; null when not known. */
  pathwayTotals: PathwayTotals | null
  /** Some layers' colours depend on the ground they are drawn on. */
  basemap: BasemapId
  placeKinds: readonly PlaceKind[]
  onTogglePlaceKind: (kind: PlaceKind) => void
}

export function Legend({
  layer,
  comfortFilters,
  onComfortFiltersChange,
  comfortTotals,
  basemap,
  placeKinds,
  onTogglePlaceKind,
  collisionSpots,
  collisions,
  busiestSpot,
  collisionFilters,
  onCollisionFiltersChange,
  theftSpots,
  thefts,
  busiestTheftSpot,
  theftFilters,
  onTheftFiltersChange,
  constructionFilters,
  onConstructionFiltersChange,
  projects,
  pathwayFilters,
  onPathwayFiltersChange,
  pathwayTotals,
}: Props) {
  const { t } = useI18n()
  return (
    <section className="legend" aria-label={t('legend')}>
      <h2 className="eyebrow">{t('legend')}</h2>
      <p className="legend-desc">{t(`layer.${layer}.desc`)}</p>
      {layer === 'comfort' && (
        <ComfortLegend filters={comfortFilters} onChange={onComfortFiltersChange} totals={comfortTotals} />
      )}
      {layer === 'pathways' && (
        <PathwayLegend
          filters={pathwayFilters}
          onChange={onPathwayFiltersChange}
          totals={pathwayTotals}
          basemap={basemap}
        />
      )}
      {layer === 'collisions' && (
        <CollisionLegend
          spots={collisionSpots}
          collisions={collisions}
          busiestSpot={busiestSpot}
          filters={collisionFilters}
          onChange={onCollisionFiltersChange}
          basemap={basemap}
        />
      )}
      {layer === 'thefts' && (
        <TheftLegend
          spots={theftSpots}
          thefts={thefts}
          busiestSpot={busiestTheftSpot}
          filters={theftFilters}
          onChange={onTheftFiltersChange}
          basemap={basemap}
        />
      )}
      {layer === 'construction' && (
        <ConstructionLegend
          filters={constructionFilters}
          onChange={onConstructionFiltersChange}
          projects={projects}
          basemap={basemap}
        />
      )}
      {layer === 'places' &&
        PLACE_GROUP_IDS.map((group) => (
          <fieldset key={group} className="place-group">
            <legend>{t(`group.${group}`)}</legend>
            {kindsInGroup(group).map((kind) => (
              <label key={kind} className="check">
                <input type="checkbox" checked={placeKinds.includes(kind)} onChange={() => onTogglePlaceKind(kind)} />
                <PlaceIcon kind={kind} />
                {t(`place.${kind}`)}
              </label>
            ))}
          </fieldset>
        ))}
    </section>
  )
}
