import { useMemo } from 'react'
import {
  COMFORT_GROUPS,
  COMFORT_SETS,
  type ComfortFilters,
  type ComfortSet,
  type ComfortTotals,
  comfortKm,
  comfortShownKm,
} from '../comfort'
import { isMessageKey, type MessageKey, useI18n } from '../i18n'
import { comfortSetColors, LTS_COLORS } from '../layers'
import { GroupRow, OTHER } from './GroupBars'

interface Props {
  filters: ComfortFilters
  onChange: (filters: ComfortFilters) => void
  /** Km by every combination of bands, from the pipeline; null while it loads or where it is missing. */
  totals: ComfortTotals | null
}

/** Each set's colours, as the map draws them. */
const COLORS = comfortSetColors()

/** The labels: the stress levels' short names, the bike infrastructure as the route card names it. */
export function labelKey(set: ComfortSet, group: string): MessageKey {
  if (set === 'stress') return `comfort.stress.${group}` as MessageKey
  if (set === 'lit' && group !== 'unknown') return `litPart.${group}` as MessageKey
  if (set === 'bikeway') {
    const named: Record<string, MessageKey> = {
      path: 'comfort.bikeway.path',
      lane: 'bikeway.lane',
      shoulder: 'bikeway.shoulder',
      shared: 'bikeway.shared',
      none: 'bikewayPart.traffic',
    }
    return named[group]
  }
  if (group === 'unknown') {
    const own = `comfort.${set}.unknown`
    return isMessageKey(own) ? own : 'unknown'
  }
  return `comfort.${set}.${group}` as MessageKey
}

/**
 * Which ways the comfort layer shows, as the other layers' filters: by stress,
 * type, speed limit, lanes, bike infrastructure, surface and lighting, each a
 * bar of km. The open row colours the map, in the colours of its bars.
 */
export function ComfortLegend({ filters, onChange, totals }: Props) {
  const { t, lang } = useI18n()
  const km = (n: number) => `${Math.round(n).toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')} km`
  const counts = useMemo(
    () => (totals ? Object.fromEntries(COMFORT_SETS.map((set) => [set, comfortKm(totals, filters, set)])) : null),
    [totals, filters],
  )
  // Without the pipeline's totals, the stress levels as a plain key.
  if (!totals || !counts) {
    return (
      <ul>
        {LTS_COLORS.map((color, i) => (
          <li key={color}>
            <span className="swatch line" style={{ background: color }} />
            {t(`lts.${(i + 1) as 1 | 2 | 3 | 4}`)}
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="collision-legend">
      <fieldset className="conditions">
        <legend>{t('comfort.filters')}</legend>
        {COMFORT_SETS.map((set) => (
          <GroupRow
            key={set}
            name={t(`comfort.${set}`)}
            groups={COMFORT_GROUPS[set]}
            counts={counts[set]}
            picked={filters.picks[set] ?? []}
            compared={COMFORT_SETS.some((other) => other !== set && filters.picks[other]?.length)}
            color={(group) => COLORS[set][group] ?? OTHER}
            label={(group) => t(labelKey(set, group))}
            amount={km}
            onPick={(next) => onChange({ ...filters, picks: { ...filters.picks, [set]: next } })}
            open={filters.by === set}
            onToggle={() => onChange({ ...filters, by: filters.by === set ? null : set })}
          />
        ))}
        <p className="footnote">{t('comfort.hint')}</p>
      </fieldset>
      <p className="collision-total">{t('comfort.shown').replace('{km}', km(comfortShownKm(totals, filters)))}</p>
    </div>
  )
}
