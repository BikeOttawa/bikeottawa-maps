import { useMemo, useState } from 'react'
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
const VALUE_STEPS = ['#D9C3EC', '#B48AD6', '#8A55B8', '#5B2A85']

function colorOf(id: TheftGroupId, group: string): string {
  if (group === 'other' || group === 'unknown') return OTHER
  if (id === 'season') return SEASON_HUES[group] ?? OTHER
  const index = (THEFT_GROUPS[id] as readonly string[]).indexOf(group)
  return id === 'value' ? VALUE_STEPS[index] : HUES[index]
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
        color={theftColors(basemap).spot}
        label={
          filters.minCount <= 1
            ? t('theft.everySpot')
            : t('theft.minCount').replace('{count}', number(filters.minCount))
        }
        onChange={(minCount) => onChange({ ...filters, minCount })}
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
