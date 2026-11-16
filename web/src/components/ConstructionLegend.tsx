import {
  CONSTRUCTION_KINDS,
  CONSTRUCTION_TIMINGS,
  type ConstructionFilters,
  type ConstructionKind,
  type ConstructionTiming,
} from '../construction'
import { useI18n } from '../i18n'
import { type BasemapId, constructionColors } from '../layers'

interface Props {
  filters: ConstructionFilters
  onChange: (filters: ConstructionFilters) => void
  basemap: BasemapId
}

const toggled = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

/** What the projects layer shows: the City's construction projects, by when and by kind. */
export function ConstructionLegend({ filters, onChange, basemap }: Props) {
  const { t } = useI18n()
  const colors = constructionColors(basemap)
  return (
    <div className="construction-legend">
      <fieldset className="place-group">
        <legend>{t('construction.when')}</legend>
        {CONSTRUCTION_TIMINGS.map((timing: ConstructionTiming) => (
          <label key={timing} className="check">
            <input
              type="checkbox"
              checked={filters.timings.includes(timing)}
              onChange={() => onChange({ ...filters, timings: toggled(filters.timings, timing) })}
            />
            <span className="swatch line" style={{ background: colors[timing] }} />
            {t(`construction.timing.${timing}`)}
          </label>
        ))}
      </fieldset>
      <fieldset className="place-group">
        <legend>{t('construction.what')}</legend>
        {CONSTRUCTION_KINDS.map((kind: ConstructionKind) => (
          <label key={kind} className="check">
            <input
              type="checkbox"
              checked={filters.kinds.includes(kind)}
              onChange={() => onChange({ ...filters, kinds: toggled(filters.kinds, kind) })}
            />
            {t(`construction.kind.${kind}`)}
          </label>
        ))}
      </fieldset>
      <p className="footnote">{t('construction.source')}</p>
    </div>
  )
}
