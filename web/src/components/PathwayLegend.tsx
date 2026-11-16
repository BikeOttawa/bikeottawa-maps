import { useMemo } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { type BasemapId, pathwaySetColors } from '../layers'
import {
  formatLength,
  LENGTH_STEPS,
  PATHWAY_GROUPS,
  PATHWAY_SETS,
  type PathwayFilters,
  type PathwaySet,
  type PathwayTotals,
  pathwayKm,
  pathwayShownKm,
} from '../pathways'
import { GroupRow, OTHER } from './GroupBars'

interface Props {
  filters: PathwayFilters
  onChange: (filters: PathwayFilters) => void
  /** Km by every combination of bands, from the pipeline; null while it loads or where it is missing. */
  totals: PathwayTotals | null
  basemap: BasemapId
}

/** The labels: plowing and lighting as the cards name them, types as OSM's. */
export function labelKey(set: PathwaySet, group: string): MessageKey {
  if (group === 'unknown') return `pathways.${set}.unknown` as MessageKey
  if (set === 'type') return `highway.${group}` as MessageKey
  if (set === 'snow') return `winter.${group}` as MessageKey
  if (set === 'lit') return `litPart.${group}` as MessageKey
  return `pathways.${set}.${group}` as MessageKey
}

/**
 * Which pathways the layer shows, as the other layers' filters: by surface,
 * type, width, snow clearing, smoothness and lighting, each a bar of km; and
 * how much pathway they must join up with. The open row colours the map, in
 * the colours of its bars, so it is the map's key too.
 */
export function PathwayLegend({ filters, onChange, totals, basemap }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const colors = pathwaySetColors(basemap)
  const km = (n: number) => `${Math.round(n).toLocaleString(locale)} km`
  const counts = useMemo(
    () => (totals ? Object.fromEntries(PATHWAY_SETS.map((set) => [set, pathwayKm(totals, filters, set)])) : null),
    [totals, filters],
  )
  const picks = filters.picks
  const length = filters.minLength
    ? t('pathways.atLeast').replace('{value}', formatLength(filters.minLength, locale))
    : t('pathways.any')

  return (
    <div className="collision-legend">
      {counts ? (
        <fieldset className="conditions">
          <legend>{t('pathways.filters')}</legend>
          {PATHWAY_SETS.map((set) => (
            <GroupRow
              key={set}
              name={t(`pathways.${set}`)}
              groups={PATHWAY_GROUPS[set]}
              counts={counts[set]}
              picked={picks[set] ?? []}
              compared={PATHWAY_SETS.some((other) => other !== set && picks[other]?.length)}
              color={(group) => colors[set][group] ?? OTHER}
              label={(group) => t(labelKey(set, group))}
              amount={km}
              onPick={(next) => onChange({ ...filters, picks: { ...picks, [set]: next } })}
              open={filters.by === set}
              onToggle={() => onChange({ ...filters, by: filters.by === set ? null : set })}
            />
          ))}
          <p className="footnote">{t('pathways.hint')}</p>
        </fieldset>
      ) : (
        // Without the pipeline's totals, the surfaces as a plain key.
        <ul>
          {PATHWAY_GROUPS.surface.map((surface) => (
            <li key={surface}>
              <span className="swatch line" style={{ background: colors.surface[surface] }} />
              {t(labelKey('surface', surface))}
            </li>
          ))}
        </ul>
      )}
      <label className="collision-min">
        <span>
          {t('pathways.length')}
          {t('colon')}
          {length}
        </span>
        <input
          className="pathway-range"
          type="range"
          min={0}
          max={LENGTH_STEPS.length - 1}
          step={1}
          value={Math.max(0, LENGTH_STEPS.indexOf(filters.minLength))}
          aria-valuetext={length}
          onChange={(e) => onChange({ ...filters, minLength: LENGTH_STEPS[Number(e.target.value)] })}
        />
        <span className="pathway-note">{t('pathways.lengthNote')}</span>
      </label>
      {totals && (
        <p className="collision-total">{t('comfort.shown').replace('{km}', km(pathwayShownKm(totals, filters)))}</p>
      )}
    </div>
  )
}
