import { type CSSProperties, useMemo, useState } from 'react'
import { type MessageKey, useI18n } from '../i18n'
import { type BasemapId, theftColors } from '../layers'
import {
  THEFT_GROUP_IDS,
  THEFT_GROUPS,
  THEFT_YEARS,
  type Theft,
  type TheftFilters,
  type TheftGroupId,
  type TheftProps,
  type TheftSpot,
  theftGroupCounts,
  theftsByMonth,
  VALUE_STOPS,
} from '../thefts'
import { GroupRow, HUES, OTHER, SEASON_HUES } from './GroupBars'
import { MinCountSlider, YearRange } from './YearRange'

interface Props {
  /** The spots shown, for the counts; null while they load. */
  spots: readonly TheftSpot[] | null
  /** Every theft, for the groups; null while they load. */
  thefts: readonly Theft[] | null
  /** The most thefts at any one spot, for the slider's top. */
  busiestSpot: number
  filters: TheftFilters
  onChange: (filters: TheftFilters) => void
  basemap: BasemapId
}

/** Values are ordered, so one purple from light to dark; the other sets take the categorical hues. */
const VALUE_HUES = ['#D9C3EC', '#B48AD6', '#8A55B8', '#5B2A85']

function colorOf(id: TheftGroupId, group: string): string {
  if (group === 'other' || group === 'unknown') return OTHER
  if (id === 'season') return SEASON_HUES[group] ?? OTHER
  const index = (THEFT_GROUPS[id] as readonly string[]).indexOf(group)
  return id === 'value' ? VALUE_HUES[index] : HUES[index]
}

function labelKey(id: TheftGroupId, group: string): MessageKey {
  if (group === 'other') return 'condition.other'
  if (group === 'unknown') return 'unknown'
  if (id === 'season') return `season.${group}` as MessageKey
  return `theft.${id}.${group}` as MessageKey
}

function TheftGroupRow({
  id,
  all,
  filters,
  onChange,
  open,
  onToggle,
}: {
  id: TheftGroupId
  all: readonly TheftProps[]
  filters: TheftFilters
  onChange: (filters: TheftFilters) => void
  open: boolean
  onToggle: () => void
}) {
  const { t } = useI18n()
  const counts = useMemo(() => theftGroupCounts(all, filters, id), [all, filters, id])
  return (
    <GroupRow
      name={t(`theftGroup.${id}`)}
      groups={THEFT_GROUPS[id]}
      counts={counts}
      picked={filters.groups[id] ?? []}
      // The tick only says something once the thefts differ from the comparison.
      compared={THEFT_GROUP_IDS.some((other) => other !== id && filters.groups[other]?.length)}
      color={(group) => colorOf(id, group)}
      label={(group) => t(labelKey(id, group))}
      onPick={(next) => onChange({ ...filters, groups: { ...filters.groups, [id]: next } })}
      open={open}
      onToggle={onToggle}
    />
  )
}

/**
 * The value slider: a stop per colour step, its track painted in them, each
 * stop on the colour of the cheapest spots still shown. Dragged right, only
 * the spots where the most was stolen stay.
 */
function MinValueSlider({
  value,
  onChange,
  basemap,
}: {
  value: number
  onChange: (value: number) => void
  basemap: BasemapId
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const { values, noValue } = theftColors(basemap)
  const index = Math.max(0, (VALUE_STOPS as readonly number[]).indexOf(value))
  const last = VALUE_STOPS.length - 1
  // Hard-edged bands, each centred on its stop.
  const bands = values.map((color, i) => {
    const from = i === 0 ? 0 : ((i - 0.5) / last) * 100
    const to = i === last ? 100 : ((i + 0.5) / last) * 100
    return `${color} ${from}% ${to}%`
  })
  const money = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
  const short = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 0 })
  return (
    <label className="collision-min">
      <span>{value > 0 ? t('theft.minValue').replace('{value}', money(value)) : t('theft.everyValue')}</span>
      <input
        className="pathway-range"
        type="range"
        min={0}
        max={last}
        step={1}
        value={index}
        aria-valuetext={money(value)}
        style={
          { '--track': `linear-gradient(to right, ${bands.join(', ')})`, '--thumb': values[index] } as CSSProperties
        }
        onChange={(e) => onChange(VALUE_STOPS[Number(e.target.value)])}
      />
      <span className="value-ticks" aria-hidden="true">
        {VALUE_STOPS.map((stop, i) => (
          <span key={stop} style={{ left: `calc(9px + (100% - 18px) * ${i / last})` }}>
            {short(stop)}
          </span>
        ))}
      </span>
      {value === 0 && (
        <span className="value-none">
          <span className="swatch dot" style={{ background: noValue }} />
          {t('theft.noValue')}
        </span>
      )}
    </label>
  )
}

/** Which years and which thefts the thefts layer shows, with how many of each. */
export function TheftLegend({ spots, thefts, busiestSpot, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  const [open, setOpen] = useState<TheftGroupId | null>('where')
  const all = useMemo(() => thefts?.map((theft) => theft.props) ?? null, [thefts])
  const months = useMemo(() => (all ? theftsByMonth(all, filters) : null), [all, filters])
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const shown = spots ? spots.reduce((sum, spot) => sum + spot.items.length, 0) : null

  return (
    <div className="collision-legend">
      <YearRange
        years={THEFT_YEARS}
        from={filters.from}
        to={filters.to}
        onChange={(from, to) => onChange({ ...filters, from, to })}
        counts={months}
        timelineLabel={t('theft.timeline')}
      />
      {all && (
        <fieldset className="conditions">
          <legend>{t('theft.filters')}</legend>
          {THEFT_GROUP_IDS.map((id) => (
            <TheftGroupRow
              key={id}
              id={id}
              all={all}
              filters={filters}
              onChange={onChange}
              open={open === id}
              onToggle={() => setOpen(open === id ? null : id)}
            />
          ))}
          <p className="footnote">{t('theft.hint')}</p>
        </fieldset>
      )}
      <MinCountSlider
        value={filters.minCount}
        busiest={busiestSpot}
        color={theftColors(basemap).values[2]}
        label={
          filters.minCount <= 1
            ? t('theft.everySpot')
            : t('theft.minCount').replace('{count}', number(filters.minCount))
        }
        onChange={(minCount) => onChange({ ...filters, minCount })}
      />
      <MinValueSlider
        value={filters.minValue}
        onChange={(minValue) => onChange({ ...filters, minValue })}
        basemap={basemap}
      />
      {shown !== null && spots && (
        <p className="collision-total">
          {t('theft.shown').replace('{count}', number(shown)).replace('{spots}', number(spots.length))}
        </p>
      )}
      <p className="footnote">
        {t('theft.source').replace('{first}', String(THEFT_YEARS.first)).replace('{last}', String(THEFT_YEARS.last))}
      </p>
    </div>
  )
}
