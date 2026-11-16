import { useMemo, useState } from 'react'
import {
  CONSTRUCTION_KINDS,
  CONSTRUCTION_TIMINGS,
  type ConstructionFilters,
  type ConstructionProps,
  constructionCounts,
  constructionShown,
} from '../construction'
import { useI18n } from '../i18n'
import { type BasemapId, constructionColors } from '../layers'
import { GroupRow, HUES, OTHER } from './GroupBars'

interface Props {
  filters: ConstructionFilters
  onChange: (filters: ConstructionFilters) => void
  /** Every project, for the counts; null while it loads. */
  projects: readonly ConstructionProps[] | null
  basemap: BasemapId
}

/** Kinds of work in the categorical hues: cycling green, roads orange, water blue, bridges amber, transit pink. */
const KIND_COLORS: Record<string, string> = {
  cycling: HUES[2],
  roads: HUES[1],
  water: HUES[0],
  bridges: HUES[3],
  transit: HUES[4],
  other: OTHER,
}

/**
 * Which projects the projects layer shows, as the other layers' filters: by
 * when, in the map's own colours, and by kind of work; a line picks its group.
 */
export function ConstructionLegend({ filters, onChange, projects, basemap }: Props) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState({ timing: true, kind: true })
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
              open={open.timing}
              onToggle={() => setOpen({ ...open, timing: !open.timing })}
            />
            <GroupRow
              name={t('construction.what')}
              groups={CONSTRUCTION_KINDS}
              counts={byKind}
              picked={filters.kinds}
              compared={filters.timings.length > 0}
              color={(group) => KIND_COLORS[group] ?? OTHER}
              label={(group) => t(`construction.kind.${group as (typeof CONSTRUCTION_KINDS)[number]}`)}
              onPick={(next) => onChange({ ...filters, kinds: next as ConstructionFilters['kinds'] })}
              open={open.kind}
              onToggle={() => setOpen({ ...open, kind: !open.kind })}
            />
            <p className="footnote">{t('construction.hint')}</p>
          </fieldset>
          <p className="collision-total">
            {t('construction.shown').replace('{count}', number(constructionShown(projects, filters)))}
          </p>
        </>
      )}
      <p className="footnote">{t('construction.source')}</p>
    </div>
  )
}
