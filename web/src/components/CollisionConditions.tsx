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

/**
 * The collisions shown, split by injury and by circumstance, as filters: a
 * line per group with a bar, a line picks those collisions. A tick on each bar
 * marks the group as it is before any pick, so a pick shows how those
 * collisions differ. Injuries stay open, as the key to the map's colours, and
 * count collisions; each circumstance is a thin split bar that opens into its
 * groups' shares.
 */

// Categorical hues in a fixed order (validated light-mode set); other is a neutral grey.
const HUES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const
const OTHER = '#9AA1A6'

const colorOf = (id: ConditionId, group: string) =>
  group === 'other' ? OTHER : HUES[(CONDITIONS[id] as readonly string[]).indexOf(group)]

const groupLabel = (id: ConditionId, group: string) =>
  (group === 'other' ? 'condition.other' : `condition.${id}.${group}`) as MessageKey

const sum = (counts: { values(): Iterable<number> }) => [...counts.values()].reduce((a, b) => a + b, 0)

function percent(share: number): string {
  if (share === 0) return '0%'
  return share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`
}

interface Line {
  key: string
  label: string
  color: string
  /** The swatch's colour when it differs from the bar's. */
  swatch?: string
  /** How long the bar is, and where the tick goes (null for none), on one scale. */
  value: number
  tick: number | null
  /** The figure at the end of the line. */
  figure: string
  title: string
}

/** Lines of bars on one scale, the longest bar the full width, each picking its group. */
function Lines({
  lines,
  picked,
  onToggle,
  onAll,
  dot,
}: {
  lines: Line[]
  picked: readonly string[]
  onToggle: (key: string) => void
  onAll: () => void
  /** Round swatches, as the map draws collisions. */
  dot?: boolean
}) {
  const { t } = useI18n()
  const top = Math.max(...lines.map((l) => Math.max(l.value, l.tick ?? 0)), Number.MIN_VALUE)
  const along = (value: number) => `${(value / top) * 100}%`
  return (
    <ul className="condition-groups">
      {lines.map((line) => {
        const isPicked = picked.includes(line.key)
        return (
          <li key={line.key}>
            <button
              type="button"
              className={picked.length && !isPicked ? 'condition-group faded' : 'condition-group'}
              aria-pressed={isPicked}
              title={line.title}
              onClick={() => onToggle(line.key)}
            >
              <span className={dot ? 'swatch dot' : 'swatch line'} style={{ background: line.swatch ?? line.color }} />
              <span className="condition-label">{line.label}</span>
              <span className="condition-bar">
                <span className="condition-fill" style={{ width: along(line.value), background: line.color }} />
                {line.tick !== null && <span className="condition-tick" style={{ left: along(line.tick) }} />}
              </span>
              <span className="share">{line.figure}</span>
            </button>
          </li>
        )
      })}
      {picked.length > 0 && (
        <li>
          <button type="button" className="condition-all" onClick={onAll}>
            {t('crash.showAll')}
          </button>
        </li>
      )}
    </ul>
  )
}

const toggled = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

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
  const present = groups.filter((group) => (counts.shown.get(group) ?? 0) > 0 || (counts.all.get(group) ?? 0) > 0)
  const lines: Line[] = present.map((group) => ({
    key: group,
    label: t(groupLabel(id, group)),
    color: colorOf(id, group),
    value: share(group),
    tick: compared ? shareAll(group) : null,
    figure: percent(share(group)),
    title: t('crash.groupShare')
      .replace('{count}', number(counts.shown.get(group) ?? 0))
      .replace('{share}', percent(share(group)))
      .replace('{all}', percent(shareAll(group))),
  }))

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
        <Lines lines={lines} picked={picked} onToggle={(key) => pick(toggled(picked, key))} onAll={() => pick([])} />
      )}
    </div>
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
