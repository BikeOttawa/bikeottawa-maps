import { useMemo } from 'react'
import {
  COLLISION_PARTIES,
  CONDITION_IDS,
  CONDITIONS,
  type Collision,
  type CollisionFilters,
  type CollisionParty,
  type CollisionProps,
  type ConditionId,
  conditionColor,
  conditionCounts,
  partyColor,
  partyCounts,
  SEVERITIES,
  SEVERITY_GROUPS,
  type Severity,
  severityCounts,
} from '../collisions'
import { type MessageKey, useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'
import { GroupRow } from './GroupBars'

/**
 * The collisions shown, split by who was involved, worst injury and circumstance, as filters:
 * each a thin split bar that opens into its groups' shares, a line picking
 * those collisions. A tick on each bar marks the group as it is before any
 * pick, so a pick shows how those collisions differ. The open row colours the
 * spots, worst injury at first.
 */

const groupLabel = (id: ConditionId, group: string) =>
  (group === 'other'
    ? 'condition.other'
    : id === 'season'
      ? `season.${group}`
      : `condition.${id}.${group}`) as MessageKey

/** Collisions by who was involved: cyclists only at first. */
function PartyRow({
  all,
  filters,
  onChange,
}: {
  all: readonly CollisionProps[]
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
}) {
  const { t } = useI18n()
  const counts = useMemo(() => partyCounts(all, filters), [all, filters])
  // Everyone shown is the same as none picked.
  const picked: readonly CollisionParty[] = filters.parties.length === COLLISION_PARTIES.length ? [] : filters.parties
  return (
    <GroupRow
      name={t('crash.party')}
      counted
      groups={COLLISION_PARTIES}
      counts={counts}
      picked={picked}
      compared={
        filters.severities.length < SEVERITIES.length || CONDITION_IDS.some((id) => filters.conditions[id]?.length)
      }
      color={partyColor}
      label={(group) => t(`crash.${group as CollisionParty}`)}
      onPick={(next) => onChange({ ...filters, parties: next.length ? (next as CollisionParty[]) : COLLISION_PARTIES })}
      open={filters.by === 'party'}
      onToggle={() => onChange({ ...filters, by: filters.by === 'party' ? null : 'party' })}
    />
  )
}

/** Collisions by worst injury, worst first, in the map's colours. */
function InjuryRow({
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
  const { t } = useI18n()
  const counts = useMemo(() => severityCounts(all, filters), [all, filters])
  const colors = collisionColors(basemap)
  // Every injury shown is the same as none picked.
  const picked: readonly Severity[] = filters.severities.length === SEVERITIES.length ? [] : filters.severities
  return (
    <GroupRow
      name={t('crash.injury')}
      counted
      groups={SEVERITY_GROUPS}
      counts={counts}
      picked={picked}
      compared={CONDITION_IDS.some((id) => filters.conditions[id]?.length)}
      color={(group) => colors[group as Severity]}
      label={(group) => t(`severity.${group as Severity}`)}
      onPick={(next) => onChange({ ...filters, severities: next.length ? (next as Severity[]) : SEVERITIES })}
      open={filters.by === 'severity'}
      onToggle={() => onChange({ ...filters, by: filters.by === 'severity' ? null : 'severity' })}
    />
  )
}

interface RowProps {
  id: ConditionId
  all: readonly CollisionProps[]
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
}

function ConditionRow({ id, all, filters, onChange }: RowProps) {
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
      color={(group) => conditionColor(id, group)}
      label={(group) => t(groupLabel(id, group))}
      onPick={(next) => onChange({ ...filters, conditions: { ...filters.conditions, [id]: next } })}
      open={filters.by === id}
      onToggle={() => onChange({ ...filters, by: filters.by === id ? null : id })}
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
  const all = useMemo(() => collisions?.map((c) => c.props) ?? null, [collisions])
  if (!all) return null
  return (
    <fieldset className="conditions">
      <legend>{t('crash.filters')}</legend>
      <PartyRow all={all} filters={filters} onChange={onChange} />
      <InjuryRow all={all} filters={filters} onChange={onChange} basemap={basemap} />
      {CONDITION_IDS.map((id) => (
        <ConditionRow key={id} id={id} all={all} filters={filters} onChange={onChange} />
      ))}
      <p className="footnote">{t('crash.conditionsHint')}</p>
    </fieldset>
  )
}
