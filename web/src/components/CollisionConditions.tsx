import { useMemo, useState } from 'react'
import {
  CONDITION_IDS,
  CONDITIONS,
  type Collision,
  type CollisionFilters,
  type CollisionProps,
  type ConditionId,
  conditionCounts,
  countBySeverity,
  SEVERITIES,
  type Severity,
} from '../collisions'
import { type MessageKey, useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'
import { GroupRow, HUES, type Line, Lines, OTHER, sum, toggled } from './GroupBars'

/**
 * The collisions shown, split by injury and by circumstance, as filters: a
 * line per group with a bar, a line picks those collisions. A tick on each bar
 * marks the group as it is before any pick, so a pick shows how those
 * collisions differ. Injuries stay open, as the key to the map's colours, and
 * count collisions; each circumstance is a thin split bar that opens into its
 * groups' shares.
 */

const colorOf = (id: ConditionId, group: string) =>
  group === 'other' ? OTHER : HUES[(CONDITIONS[id] as readonly string[]).indexOf(group)]

const groupLabel = (id: ConditionId, group: string) =>
  (group === 'other' ? 'condition.other' : `condition.${id}.${group}`) as MessageKey

/**
 * Collisions by worst injury, worst first, in the map's colours. Picking some
 * shows only those; with a circumstance picked, the tick is how many there
 * would be if those collisions ended like the rest.
 */
function InjuryLines({
  all,
  filters,
  onChange,
  basemap,
}: {
  all: readonly CollisionProps[]
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}) {
  const { t, lang } = useI18n()
  const shown = useMemo(() => countBySeverity(all, filters), [all, filters])
  const usual = useMemo(() => countBySeverity(all, { ...filters, conditions: {} }), [all, filters])
  // The dots are the key to the map; the bars are on the pale panel, darker as injuries worsen.
  const onMap = collisionColors(basemap)
  const onPanel = collisionColors('light')
  // Every injury shown is the same as none picked.
  const picked: readonly Severity[] = filters.severities.length === SEVERITIES.length ? [] : filters.severities
  const total = sum(Object.values(shown))
  const usualTotal = sum(Object.values(usual))
  const compared = CONDITION_IDS.some((id) => filters.conditions[id]?.length)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const expected = (s: Severity) => (usualTotal ? (usual[s] / usualTotal) * total : 0)
  const pick = (next: readonly Severity[]) => onChange({ ...filters, severities: next.length ? next : SEVERITIES })
  const lines: Line[] = [...SEVERITIES].reverse().map((s) => ({
    key: s,
    label: t(`severity.${s}`),
    color: onPanel[s],
    swatch: onMap[s],
    value: shown[s],
    tick: compared ? expected(s) : null,
    figure: number(shown[s]),
    title: compared
      ? t('crash.injuryExpected')
          .replace('{count}', number(shown[s]))
          .replace('{expected}', number(Math.round(expected(s))))
      : number(shown[s]),
  }))
  return (
    <fieldset className="conditions">
      <legend>{t('crash.injury')}</legend>
      <Lines
        lines={lines}
        picked={picked}
        onToggle={(key) => pick(toggled(picked, key as Severity))}
        onAll={() => pick([])}
        dot
      />
    </fieldset>
  )
}

interface RowProps {
  id: ConditionId
  all: readonly CollisionProps[]
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  open: boolean
  onToggle: () => void
}

function ConditionRow({ id, all, filters, onChange, open, onToggle }: RowProps) {
  const { t } = useI18n()
  const counts = useMemo(() => conditionCounts(all, filters, id), [all, filters, id])
  // The tick only says something once the collisions differ from the comparison.
  const compared =
    filters.severities.length < 5 || CONDITION_IDS.some((other) => other !== id && filters.conditions[other]?.length)
  return (
    <GroupRow
      name={t(`condition.${id}` as MessageKey)}
      groups={CONDITIONS[id]}
      counts={counts}
      picked={filters.conditions[id] ?? []}
      compared={compared}
      color={(group) => colorOf(id, group)}
      label={(group) => t(groupLabel(id, group))}
      onPick={(next) => onChange({ ...filters, conditions: { ...filters.conditions, [id]: next } })}
      open={open}
      onToggle={onToggle}
    />
  )
}

interface Props {
  /** Every collision, null while they load. */
  collisions: readonly Collision[] | null
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

export function CollisionConditions({ collisions, filters, onChange, basemap }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<ConditionId | null>(null)
  const all = useMemo(() => collisions?.map((c) => c.props) ?? null, [collisions])
  if (!all) return null
  return (
    <>
      <InjuryLines all={all} filters={filters} onChange={onChange} basemap={basemap} />
      <fieldset className="conditions">
        <legend>{t('crash.conditions')}</legend>
        {CONDITION_IDS.map((id) => (
          <ConditionRow
            key={id}
            id={id}
            all={all}
            filters={filters}
            onChange={onChange}
            open={open === id}
            onToggle={() => setOpen(open === id ? null : id)}
          />
        ))}
        <p className="footnote">{t('crash.conditionsHint')}</p>
      </fieldset>
    </>
  )
}
