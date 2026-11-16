import { useMemo } from 'react'
import {
  COLLISION_PARTIES,
  COLLISION_YEARS,
  type Collision,
  type CollisionFilters,
  type CollisionSpot,
  countByMonth,
} from '../collisions'
import { useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'
import { CollisionConditions } from './CollisionConditions'
import { MinCountSlider, YearRange } from './YearRange'

interface Props {
  /** The spots shown, for the counts; null while they load. */
  spots: readonly CollisionSpot[] | null
  /** Every collision, for the circumstances; null while they load. */
  collisions: readonly Collision[] | null
  /** The most collisions at any one spot, for the slider's top. */
  busiestSpot: number
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

/** Who, which years and which injuries the collisions layer shows, with how many of each. */
export function CollisionLegend({ spots, collisions, busiestSpot, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  // Collisions shown, by worst injury: those in the spots left on the map.
  const counts = useMemo(() => {
    if (!spots) return null
    const byInjury = { none: 0, minimal: 0, minor: 0, major: 0, fatal: 0 }
    for (const spot of spots) for (const p of spot.items) byInjury[p.severity]++
    return byInjury
  }, [spots])
  const colors = collisionColors(basemap)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const shown = counts ? filters.severities.reduce((sum, s) => sum + counts[s], 0) : null

  const months = useMemo(
    () =>
      collisions
        ? countByMonth(
            collisions.map((c) => c.props),
            filters,
          )
        : null,
    [collisions, filters],
  )
  const changeYears = (from: number, to: number) => onChange({ ...filters, from, to })

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  return (
    <div className="collision-legend">
      <div className="collision-parties">
        {COLLISION_PARTIES.map((party) => (
          <label key={party} className="check">
            <input
              type="checkbox"
              checked={filters.parties.includes(party)}
              onChange={() => onChange({ ...filters, parties: toggle(filters.parties, party) })}
            />
            {t(`crash.${party}`)}
          </label>
        ))}
      </div>
      <YearRange
        years={COLLISION_YEARS}
        from={filters.from}
        to={filters.to}
        onChange={changeYears}
        counts={months}
        timelineLabel={t('crash.timeline')}
      />
      <CollisionConditions collisions={collisions} filters={filters} onChange={onChange} basemap={basemap} />
      <MinCountSlider
        value={filters.minCount}
        busiest={busiestSpot}
        color={colors.minor}
        label={
          filters.minCount <= 1
            ? t('crash.everySpot')
            : t('crash.minCount').replace('{count}', number(filters.minCount))
        }
        onChange={(minCount) => onChange({ ...filters, minCount })}
      />
      {shown !== null && spots && (
        <p className="collision-total">
          {t('crash.shown').replace('{count}', number(shown)).replace('{spots}', number(spots.length))}
        </p>
      )}
      <p className="footnote">
        {t('crash.source')
          .replace('{first}', String(COLLISION_YEARS.first))
          .replace('{last}', String(COLLISION_YEARS.last))}
      </p>
    </div>
  )
}
