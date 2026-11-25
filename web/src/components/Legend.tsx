import type { CSSProperties } from 'react'
import type { Collision, CollisionFilters, CollisionSpot } from '../collisions'
import type { ComfortFilters, ComfortTotals } from '../comfort'
import type { ConstructionFilters, ConstructionProps } from '../construction'
import { useI18n } from '../i18n'
import type { BasemapId, LayerId } from '../layers'
import type { PathwayFilters, PathwayTotals } from '../pathways'
import { kindsInGroup, PLACE_GROUP_IDS, type PlaceGroupId, type PlaceKind, placeColor } from '../places'
import type { Theft, TheftFilters, TheftSpot } from '../thefts'
import { CollisionLegend } from './CollisionLegend'
import { ComfortLegend } from './ComfortLegend'
import { ConstructionLegend } from './ConstructionLegend'
import { AddPlaceIcon } from './icons'
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
  onPlaceKindsChange: (kinds: readonly PlaceKind[]) => void
  /** Puts a pin on the map for a place that is missing. */
  onAddPlace: () => void
}

export function Legend({
  layer,
  comfortFilters,
  onComfortFiltersChange,
  comfortTotals,
  basemap,
  placeKinds,
  onPlaceKindsChange,
  onAddPlace,
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
      {/* Places say what they are on their chips. */}
      {layer !== 'places' && <p className="legend-desc">{t(`layer.${layer}.desc`)}</p>}
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
      {layer === 'places' && (
        <>
          {PLACE_GROUP_IDS.map((group) => (
            <PlaceGroup key={group} group={group} picked={placeKinds} onChange={onPlaceKindsChange} />
          ))}
          <div className="add-place">
            <button type="button" className="card-edit-open" onClick={() => onAddPlace()}>
              <AddPlaceIcon />
              {t('add')}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

/**
 * A group of place kinds: a chip per kind that shows or hides it, and a tick
 * box on the group's name for all of them, half ticked when some are on.
 */
function PlaceGroup({
  group,
  picked,
  onChange,
}: {
  group: PlaceGroupId
  picked: readonly PlaceKind[]
  onChange: (kinds: readonly PlaceKind[]) => void
}) {
  const { t } = useI18n()
  const kinds = kindsInGroup(group)
  const on = kinds.filter((kind) => picked.includes(kind))
  const all = on.length === kinds.length
  return (
    <fieldset className="place-group">
      <legend>
        <label className="check">
          <input
            type="checkbox"
            checked={all}
            ref={(input) => {
              if (input) input.indeterminate = on.length > 0 && !all
            }}
            onChange={() =>
              onChange(
                all
                  ? picked.filter((kind) => !kinds.includes(kind))
                  : [...picked, ...kinds.filter((kind) => !on.includes(kind))],
              )
            }
          />
          {t(`group.${group}`)}
        </label>
      </legend>
      <div className="place-chips">
        {kinds.map((kind) => {
          const isOn = on.includes(kind)
          return (
            <button
              key={kind}
              type="button"
              className="place-chip"
              aria-pressed={isOn}
              style={{ '--chip': placeColor(kind) } as CSSProperties}
              onClick={() => onChange(isOn ? picked.filter((k) => k !== kind) : [...picked, kind])}
            >
              <PlaceIcon kind={kind} />
              {t(`place.${kind}`)}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
