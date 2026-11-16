import { useMemo, useState } from 'react'
import {
  CONDITION_IDS,
  CONDITIONS,
  type Collision,
  type CollisionFilters,
  type CollisionProps,
  type ConditionId,
  conditionCounts,
} from '../collisions'
import { type MessageKey, useI18n } from '../i18n'

/**
 * The circumstances of the collisions shown, as a filter: each one a thin
 * split bar, opened into a line per group with its share. A line picks those
 * collisions; a tick on each bar marks its share before any injury or
 * circumstance was picked, so a pick shows how those collisions differ.
 */

// Categorical hues in a fixed order (validated light-mode set); other is a neutral grey.
const HUES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
const OTHER = '#9AA1A6'

const colorOf = (id: ConditionId, group: string) =>
  group === 'other' ? OTHER : HUES[(CONDITIONS[id] as readonly string[]).indexOf(group)]

const groupLabel = (id: ConditionId, group: string) =>
  (group === 'other' ? 'condition.other' : `condition.${id}.${group}`) as MessageKey

const sum = (counts: Map<string, number>) => [...counts.values()].reduce((a, b) => a + b, 0)

function percent(share: number): string {
  if (share === 0) return '0%'
  return share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`
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
  const { t, lang } = useI18n()
  const counts = useMemo(() => conditionCounts(all, filters, id), [all, filters, id])
  const picked = filters.conditions[id] ?? []
  const groups = CONDITIONS[id] as readonly string[]
  const total = sum(counts.shown)
  const totalAll = sum(counts.all)
  const share = (group: string) => (total ? (counts.shown.get(group) ?? 0) / total : 0)
  const shareAll = (group: string) => (totalAll ? (counts.all.get(group) ?? 0) / totalAll : 0)
  // The tick only says something once the collisions differ from the comparison.
  const compared =
    filters.severities.length < 5 || CONDITION_IDS.some((other) => other !== id && filters.conditions[other]?.length)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const pick = (next: string[]) => onChange({ ...filters, conditions: { ...filters.conditions, [id]: next } })
  const toggle = (group: string) =>
    pick(picked.includes(group) ? picked.filter((g) => g !== group) : [...picked, group])
  const present = groups.filter((group) => (counts.shown.get(group) ?? 0) > 0 || (counts.all.get(group) ?? 0) > 0)
  // Bars run to the largest share in the list, so the small groups still show; the figures give the shares.
  const top = Math.max(...present.map((g) => Math.max(share(g), compared ? shareAll(g) : 0)), 0.01)
  const along = (value: number) => `${(value / top) * 100}%`

  return (
    <div className={open ? 'condition open' : 'condition'}>
      <button type="button" className="condition-head" aria-expanded={open} onClick={onToggle}>
        <span className="condition-name">
          {t(`condition.${id}` as MessageKey)}
          {picked.length > 0 && (
            <span className="condition-picked">{picked.map((g) => t(groupLabel(id, g))).join(', ')}</span>
          )}
        </span>
        <span className="condition-split" aria-hidden="true">
          {present
            .filter((group) => (counts.shown.get(group) ?? 0) > 0)
            .map((group) => (
              <span
                key={group}
                className={picked.length && !picked.includes(group) ? 'faded' : undefined}
                style={{ flexGrow: counts.shown.get(group), background: colorOf(id, group) }}
              />
            ))}
        </span>
        <svg className="condition-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul className="condition-groups">
          {present.map((group) => {
            const isPicked = picked.includes(group)
            const title = t('crash.groupShare')
              .replace('{count}', number(counts.shown.get(group) ?? 0))
              .replace('{share}', percent(share(group)))
              .replace('{all}', percent(shareAll(group)))
            return (
              <li key={group}>
                <button
                  type="button"
                  className={picked.length && !isPicked ? 'condition-group faded' : 'condition-group'}
                  aria-pressed={isPicked}
                  title={title}
                  onClick={() => toggle(group)}
                >
                  <span className="swatch line" style={{ background: colorOf(id, group) }} />
                  <span className="condition-label">{t(groupLabel(id, group))}</span>
                  <span className="condition-bar">
                    <span
                      className="condition-fill"
                      style={{ width: along(share(group)), background: colorOf(id, group) }}
                    />
                    {compared && <span className="condition-tick" style={{ left: along(shareAll(group)) }} />}
                  </span>
                  <span className="share">{percent(share(group))}</span>
                </button>
              </li>
            )
          })}
          {picked.length > 0 && (
            <li>
              <button type="button" className="condition-all" onClick={() => pick([])}>
                {t('crash.showAll')}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  )
}

interface Props {
  /** Every collision, null while they load. */
  collisions: readonly Collision[] | null
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
}

export function CollisionConditions({ collisions, filters, onChange }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<ConditionId | null>(null)
  const all = useMemo(() => collisions?.map((c) => c.props) ?? null, [collisions])
  if (!all) return null
  return (
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
  )
}
