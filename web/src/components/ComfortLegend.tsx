import { useMemo, useState } from 'react'
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
import { bikewayColors, LTS_COLORS, pathwayColors, pathwaySetColors } from '../layers'
import { partLook } from '../route/breakdown'
import { GroupRow, OTHER } from './GroupBars'

interface Props {
  filters: ComfortFilters
  onChange: (filters: ComfortFilters) => void
  /** Km by every combination of bands, from the pipeline; null while it loads or where it is missing. */
  totals: ComfortTotals | null
}

/** Speed limits are ordered: one red from light to dark, the slowest lightest. */
const SPEED_STEPS = ['#F6D5B8', '#EDAF7F', '#E2804A', '#C8502A', '#8E2A12']

/** Road classes, minor to major: one slate from light to dark; pathways green, tracks brown. */
const TYPE_COLORS: Record<string, string> = {
  path: '#1E7B34',
  residential: '#C8D3DB',
  service: '#AFBBC4',
  minor: '#94A6B6',
  tertiary: '#7690A8',
  secondary: '#56748F',
  primary: '#3A5873',
  trunk: '#22394F',
  track: '#B39264',
  other: OTHER,
}

/** Lanes each way, ordered too: one blue, a single lane lightest. */
const LANE_STEPS = ['#A9CBEA', '#4D8FCC', '#1F4E8C']

const surfaces = pathwayColors('light')

/** Each set's colours: stress in the map's own, the rest in the colours they have elsewhere in the app. */
const COLORS: Record<ComfortSet, Record<string, string>> = {
  stress: { '1': LTS_COLORS[0], '2': LTS_COLORS[1], '3': LTS_COLORS[2], '4': LTS_COLORS[3] },
  type: TYPE_COLORS,
  speed: Object.fromEntries(COMFORT_GROUPS.speed.map((g, i) => [g, SPEED_STEPS[i] ?? OTHER])),
  lanes: { '1': LANE_STEPS[0], '2': LANE_STEPS[1], '3': LANE_STEPS[2], unknown: OTHER },
  bikeway: {
    path: partLook('bikeway', 'path').color,
    lane: partLook('bikeway', 'lane').color,
    shoulder: partLook('bikeway', 'shoulder').color,
    shared: bikewayColors('light').shared,
    none: partLook('bikeway', 'traffic').color,
  },
  surface: { paved: surfaces.surface.asphalt, unpaved: surfaces.surface.gravel, unknown: OTHER },
  lit: pathwaySetColors('light').lit,
}

/** The labels: the stress levels' short names, the bike infrastructure as the route card names it. */
function labelKey(set: ComfortSet, group: string): MessageKey {
  if (set === 'stress') return `comfort.stress.${group}` as MessageKey
  if (set === 'lit') return `litPart.${group}` as MessageKey
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
 * Which ways the comfort layer shows, as the other layers' filters: by stress
 * (the map's colours, its key), speed limit, lanes, bike infrastructure and
 * surface, each a bar of km.
 */
export function ComfortLegend({ filters, onChange, totals }: Props) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<ComfortSet | null>('stress')
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
            picked={filters[set] ?? []}
            compared={COMFORT_SETS.some((other) => other !== set && filters[other]?.length)}
            color={(group) => COLORS[set][group] ?? OTHER}
            label={(group) => t(labelKey(set, group))}
            amount={km}
            onPick={(next) => onChange({ ...filters, [set]: next })}
            open={open === set}
            onToggle={() => setOpen(open === set ? null : set)}
          />
        ))}
        <p className="footnote">{t('comfort.hint')}</p>
      </fieldset>
      <p className="collision-total">{t('comfort.shown').replace('{km}', km(comfortShownKm(totals, filters)))}</p>
    </div>
  )
}
