import { type CSSProperties, useMemo } from 'react'
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
  theftGroupColor,
  theftGroupCounts,
  theftsByMonth,
  VALUE_STOPS,
} from '../thefts'
import { GroupRow } from './GroupBars'
import { LegendNote } from './LegendNote'
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
      color={(group) => theftGroupColor(id, group)}
      label={(group) => t(labelKey(id, group))}
      onPick={(next) => onChange({ ...filters, groups: { ...filters.groups, [id]: next } })}
      open={open}
      onToggle={onToggle}
    />
  )
}

/**
 * The value slider, painted as the map's scale: a tick at each stop, each
 * colour the band between two ticks. The knob keeps the spots from its stop
 * up; the bands left of it, filtered out, fade.
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
  const { values } = theftColors(basemap)
  const index = Math.max(0, (VALUE_STOPS as readonly number[]).indexOf(value))
  const last = VALUE_STOPS.length - 1
  // Where a stop's knob centre sits along the track: the knob is 18px wide.
  const at = (i: number) => `calc(9px + (100% - 18px) * ${i / last})`
  const bands = values.map((color, i) => {
    const shown = i >= index ? color : `color-mix(in srgb, ${color} 30%, #e4e8ea)`
    return `${shown} ${i === 0 ? '0%' : at(i)} ${i === values.length - 1 ? '100%' : at(i + 1)}`
  })
  const money = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
  const short = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 0 })
  return (
    <label className="collision-min">
      <span>
        {t('theft.valueAt')}
        {t('colon')}
        {value > 0 ? t('theft.valueOrMore').replace('{value}', money(value)) : t('theft.valueAny')}
      </span>
      <input
        className="pathway-range"
        type="range"
        min={0}
        max={last}
        step={1}
        value={index}
        aria-valuetext={money(value)}
        style={
          {
            '--track': `linear-gradient(to right, ${bands.join(', ')})`,
            '--thumb': values[Math.min(index, values.length - 1)],
          } as CSSProperties
        }
        onChange={(e) => onChange(VALUE_STOPS[Number(e.target.value)])}
      />
      <span className="value-ticks" aria-hidden="true">
        {VALUE_STOPS.map((stop, i) => (
          <span key={stop} style={{ left: at(i) }}>
            {short(stop)}
          </span>
        ))}
      </span>
    </label>
  )
}

/** Which years and which thefts the thefts layer shows, with how many of each. */
export function TheftLegend({ spots, thefts, busiestSpot, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
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
              open={filters.by === id}
              onToggle={() => onChange({ ...filters, by: filters.by === id ? null : id })}
            />
          ))}
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
      <LegendNote>
        <p>{t('theft.hint')}</p>
        <p>{t('theft.circles')}</p>
        <p>
          {t('theft.source').replace('{first}', String(THEFT_YEARS.first)).replace('{last}', String(THEFT_YEARS.last))}
        </p>
      </LegendNote>
    </div>
  )
}
