import type { CSSProperties } from 'react'
import { useI18n } from '../i18n'

export { HUES, OTHER, SEASON_HUES } from '../layers'

/**
 * Filters drawn as bars: a line per group with a bar, a line picks those
 * items. A tick on each bar marks the group as it is before any pick, so a
 * pick shows how the items picked differ. Shared by the collisions and thefts
 * legends.
 */

export const sum = (counts: { values(): Iterable<number> }) => [...counts.values()].reduce((a, b) => a + b, 0)

export function percent(share: number): string {
  if (share === 0) return '0%'
  return share < 0.01 ? '<1%' : `${Math.round(share * 100)}%`
}

export const toggled = <T,>(list: readonly T[], value: T): T[] =>
  list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

export interface Line {
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
export function Lines({
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
  /** Round swatches, as the map draws points. */
  dot?: boolean
}) {
  const { t } = useI18n()
  const top = Math.max(...lines.map((l) => Math.max(l.value, l.tick ?? 0)), Number.MIN_VALUE)
  const along = (value: number) => `${(value / top) * 100}%`
  // The figures' column fits the longest, the same on every line so the bars line up.
  const figure = { '--figure': `${Math.max(...lines.map((l) => l.figure.length))}ch` } as CSSProperties
  return (
    <ul className="condition-groups" style={figure}>
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
      {/* Always there, hidden until something is picked, so picking moves nothing below. */}
      <li>
        <button
          type="button"
          className="condition-all"
          onClick={onAll}
          disabled={!picked.length}
          style={picked.length ? undefined : { visibility: 'hidden' }}
        >
          {t('crash.showAll')}
        </button>
      </li>
    </ul>
  )
}

/** How the items split over one set of groups: `shown` under the other filters, `all` to compare with. */
export interface GroupCounts {
  shown: Map<string, number>
  all: Map<string, number>
}

/**
 * One set of groups as a thin split bar under its name, opening into a line
 * per group with how many it has. What is picked shows beside the name.
 */
export function GroupRow({
  name,
  groups,
  counts,
  picked,
  compared,
  color,
  label,
  amount,
  onPick,
  open,
  onToggle,
}: {
  name: string
  groups: readonly string[]
  counts: GroupCounts
  picked: readonly string[]
  /** Whether the items differ from the comparison, so the ticks say something. */
  compared: boolean
  color: (group: string) => string
  label: (group: string) => string
  /** How an amount is written: a count by default. */
  amount?: (n: number) => string
  onPick: (next: string[]) => void
  open: boolean
  onToggle: () => void
}) {
  const { t, lang } = useI18n()
  const total = sum(counts.shown)
  const totalAll = sum(counts.all)
  const share = (group: string) => (total ? (counts.shown.get(group) ?? 0) / total : 0)
  const shareAll = (group: string) => (totalAll ? (counts.all.get(group) ?? 0) / totalAll : 0)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const present = groups.filter((group) => (counts.shown.get(group) ?? 0) > 0 || (counts.all.get(group) ?? 0) > 0)
  const lines: Line[] = present.map((group) => ({
    key: group,
    label: label(group),
    color: color(group),
    value: share(group),
    tick: compared ? shareAll(group) : null,
    figure: (amount ?? number)(counts.shown.get(group) ?? 0),
    title: t('crash.groupShare')
      .replace('{count}', (amount ?? number)(counts.shown.get(group) ?? 0))
      .replace('{share}', percent(share(group)))
      .replace('{all}', percent(shareAll(group))),
  }))

  return (
    <div className={open ? 'condition open' : 'condition'}>
      <button type="button" className="condition-head" aria-expanded={open} onClick={onToggle}>
        <span className="condition-name">
          {name}
          {/* A line kept for what is picked, so the row does not grow when something is. */}
          <span className="condition-picked">{picked.map(label).join(', ')}</span>
        </span>
        <span className="condition-split" aria-hidden="true">
          {present
            .filter((group) => (counts.shown.get(group) ?? 0) > 0)
            .map((group) => (
              <span
                key={group}
                className={picked.length && !picked.includes(group) ? 'faded' : undefined}
                style={{ flexGrow: counts.shown.get(group), background: color(group) }}
              />
            ))}
        </span>
        <svg className="condition-chevron" aria-hidden="true" width="12" height="12" viewBox="0 0 12 12">
          <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <Lines
          lines={lines}
          picked={picked}
          onToggle={(key) => onPick(toggled(picked, key))}
          onAll={() => onPick([])}
        />
      )}
    </div>
  )
}
