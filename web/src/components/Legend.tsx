import type { Collision, CollisionFilters, CollisionSpot } from '../collisions'
import type { ConstructionFilters } from '../construction'
import { useI18n } from '../i18n'
import { type BasemapId, type LayerId, LTS_COLORS, lampColor, WINTER_COLORS } from '../layers'
import type { PathwayFilters, PathwayKm } from '../pathways'
import { kindsInGroup, PLACE_GROUP_IDS, type PlaceKind } from '../places'
import type { Theft, TheftFilters, TheftSpot } from '../thefts'
import { CollisionLegend } from './CollisionLegend'
import { ConstructionLegend } from './ConstructionLegend'
import { PathwayLegend } from './PathwayLegend'
import { PlaceIcon } from './PlaceIcon'
import { TheftLegend } from './TheftLegend'

interface Props {
  layer: LayerId
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
  pathwayFilters: PathwayFilters
  onPathwayFiltersChange: (filters: PathwayFilters) => void
  /** Km of pathway, from the pipeline; null when not known. */
  pathwayKm: PathwayKm | null
  /** The night layer's colours depend on the ground they are drawn on. */
  basemap: BasemapId
  placeKinds: readonly PlaceKind[]
  onTogglePlaceKind: (kind: PlaceKind) => void
}

export function Legend({
  layer,
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
  pathwayFilters,
  onPathwayFiltersChange,
  pathwayKm,
}: Props) {
  const { t } = useI18n()
  const lamp = lampColor(basemap)
  return (
    <section className="legend" aria-label={t('legend')}>
      <h2 className="eyebrow">{t('legend')}</h2>
      <p className="legend-desc">{t(`layer.${layer}.desc`)}</p>
      {layer === 'comfort' && (
        <ul>
          {LTS_COLORS.map((color, i) => (
            <li key={color}>
              <span className="swatch line" style={{ background: color }} />
              {t(`lts.${(i + 1) as 1 | 2 | 3 | 4}`)}
            </li>
          ))}
        </ul>
      )}
      {layer === 'pathways' && (
        <PathwayLegend filters={pathwayFilters} onChange={onPathwayFiltersChange} km={pathwayKm} basemap={basemap} />
      )}
      {layer === 'winter' && (
        <ul>
          {(['yes', 'no', 'unknown'] as const).map((value) => (
            <li key={value}>
              <span
                className={`swatch line ${value === 'unknown' ? 'dashed' : ''}`}
                style={{
                  color: WINTER_COLORS[value],
                  background: value === 'unknown' ? undefined : WINTER_COLORS[value],
                }}
              />
              {t(`winter.${value}`)}
            </li>
          ))}
        </ul>
      )}
      {layer === 'night' && (
        <ul>
          <li>
            <span className="swatch line glow" style={{ background: lamp, color: lamp }} />
            {t('night.street')}
          </li>
          <li>
            <span className="swatch lamp" style={{ background: lamp, color: lamp }} />
            {t('night.lamp')}
          </li>
        </ul>
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
        <ConstructionLegend filters={constructionFilters} onChange={onConstructionFiltersChange} basemap={basemap} />
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
