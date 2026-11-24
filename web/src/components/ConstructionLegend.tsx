import { useMemo } from 'react'
import {
  CONSTRUCTION_KINDS,
  CONSTRUCTION_TIMINGS,
  type ConstructionFilters,
  type ConstructionProps,
  constructionCounts,
  constructionShown,
} from '../construction'
import { useI18n } from '../i18n'
import { type BasemapId, CONSTRUCTION_KIND_COLORS, constructionColors } from '../layers'
import { sourceLine } from '../region'
import { GroupRow, OTHER } from './GroupBars'
import { LegendNote } from './LegendNote'

interface Props {
  filters: ConstructionFilters
  onChange: (filters: ConstructionFilters) => void
  /** Every project, for the counts; null while it loads. */
  projects: readonly ConstructionProps[] | null
  basemap: BasemapId
}

/**
 * Which projects the projects layer shows, as the other layers' filters: by
 * when and by kind of work; a line picks its group. The open row colours the
 * map, in the colours of its bars.
 */
export function ConstructionLegend({ filters, onChange, projects, basemap }: Props) {
  const { t, lang } = useI18n()
  const timingColors = constructionColors(basemap)
  const byTiming = useMemo(
    () => (projects ? constructionCounts(projects, filters, 'timing') : null),
    [projects, filters],
  )
  const byKind = useMemo(() => (projects ? constructionCounts(projects, filters, 'kind') : null), [projects, filters])
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  return (
    <div className="collision-legend">
      {byTiming && byKind && projects && (
        <>
          <fieldset className="conditions">
            <legend>{t('construction.filters')}</legend>
            <GroupRow
              name={t('construction.when')}
              groups={CONSTRUCTION_TIMINGS}
              counts={byTiming}
              picked={filters.timings}
              compared={filters.kinds.length > 0}
              color={(group) => timingColors[group as keyof typeof timingColors]}
              label={(group) => t(`construction.timing.${group as (typeof CONSTRUCTION_TIMINGS)[number]}`)}
              onPick={(next) => onChange({ ...filters, timings: next as ConstructionFilters['timings'] })}
              open={filters.by === 'timing'}
              onToggle={() => onChange({ ...filters, by: filters.by === 'timing' ? null : 'timing' })}
            />
            <GroupRow
              name={t('construction.what')}
              groups={CONSTRUCTION_KINDS}
              counts={byKind}
              picked={filters.kinds}
              compared={filters.timings.length > 0}
              color={(group) => CONSTRUCTION_KIND_COLORS[group] ?? OTHER}
              label={(group) => t(`construction.kind.${group as (typeof CONSTRUCTION_KINDS)[number]}`)}
              onPick={(next) => onChange({ ...filters, kinds: next as ConstructionFilters['kinds'] })}
              open={filters.by === 'kind'}
              onToggle={() => onChange({ ...filters, by: filters.by === 'kind' ? null : 'kind' })}
            />
          </fieldset>
          <p className="collision-total">
            {t('construction.shown').replace('{count}', number(constructionShown(projects, filters)))}
          </p>
        </>
      )}
      <LegendNote>
        {projects && <p>{t('construction.hint')}</p>}
        <p>
          {sourceLine('construction', lang)} {t('construction.updated')}
        </p>
      </LegendNote>
    </div>
  )
}
