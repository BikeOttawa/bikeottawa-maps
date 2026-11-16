import { type ReactNode, useMemo } from 'react'
import {
  COLLISION_PARTIES,
  COLLISION_YEARS,
  type Collision,
  type CollisionFilters,
  type CollisionSpot,
  countByMonth,
} from '../collisions'
import { useI18n } from '../i18n'
import { type BasemapId, collisionColors } from '../layers'
import { CollisionConditions } from './CollisionConditions'

interface Props {
  /** The spots shown, for the counts; null while they load. */
  spots: readonly CollisionSpot[] | null
  /** Every collision, for the circumstances; null while they load. */
  collisions: readonly Collision[] | null
  /** The most collisions at any one spot, for the slider's top. */
  busiestSpot: number
  filters: CollisionFilters
  onChange: (filters: CollisionFilters) => void
  basemap: BasemapId
}

/** A spot's circle as the map draws it in the middle of its zoom range: area grows with the count. */
function SpotDot({ count, color }: { count: number; color: string }) {
  const r = 4 + 2.2 * Math.sqrt(Math.max(0, count - 1))
  const size = Math.ceil(2 * r + 2)
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="spot-dot">
      <circle cx={size / 2} cy={size / 2} r={r} fill={color} stroke="#fff" />
    </svg>
  )
}

/** The slider's handles are this wide; their centres run from half of it in to half of it from the end. */
const HANDLE = 18

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

/** Where a year's handle centre sits along the slider, as CSS. */
const yearAt = (year: number) => {
  const { first, last } = COLLISION_YEARS
  return `(${HANDLE / 2}px + (100% - ${HANDLE}px) * ${(year - first) / (last - first)})`
}

/**
 * The collisions month by month, each year's months over that year's place on
 * the slider: the years picked in the accent, the others grey. A year picks
 * that year alone; picked alone, it gives back every year.
 */
function Timeline({
  counts,
  from,
  to,
  onChange,
}: {
  counts: Map<string, number>
  from: number
  to: number
  onChange: (from: number, to: number) => void
}) {
  const { t, lang } = useI18n()
  const { first, last, missing } = COLLISION_YEARS
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const max = Math.max(1, ...counts.values())
  const band = `((100% - ${HANDLE}px) / ${last - first})`
  const month = (m: number) => new Date(2000, m, 1).toLocaleString(locale, { month: 'long' })
  const years = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  return (
    <div className="timeline" role="img" aria-label={t('crash.timeline')}>
      {years.map((year) => {
        const style = { left: `calc(${yearAt(year)} - ${band} / 2)`, width: `calc(${band})` }
        const label = <span className="timeline-label">{year}</span>
        if ((missing as readonly number[]).includes(year)) {
          return (
            <div key={year} className="timeline-year missing" style={style} title={t('crash.notPublished')}>
              <span className="timeline-months" />
              {label}
            </div>
          )
        }
        const alone = from === year && to === year
        return (
          <button
            key={year}
            type="button"
            className={year >= from && year <= to ? 'timeline-year' : 'timeline-year out'}
            style={style}
            aria-label={t(alone ? 'crash.everyYear' : 'crash.onlyYear').replace('{year}', String(year))}
            onClick={() => (alone ? onChange(first, last) : onChange(year, year))}
          >
            <span className="timeline-months">
              {MONTHS.map((m, i) => {
                const n = counts.get(`${year}-${m}`) ?? 0
                return (
                  <span key={m} className="timeline-month" title={`${month(i)} ${year}${t('colon')}${n}`}>
                    <span className="timeline-bar" style={{ height: `${(n / max) * 100}%` }} />
                  </span>
                )
              })}
            </span>
            {label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Years as one slider with two handles: two range inputs on one track, only
 * their handles taking the pointer, the span between them highlighted. The
 * timeline, if any, goes between its caption and its track.
 */
function YearRange({
  from,
  to,
  onChange,
  children,
}: {
  from: number
  to: number
  onChange: (from: number, to: number) => void
  children?: ReactNode
}) {
  const { t } = useI18n()
  const { first, last } = COLLISION_YEARS
  return (
    <div className="year-range">
      <span>
        {t('crash.years')}
        {t('colon')}
        {from === to ? from : `${from} – ${to}`}
      </span>
      {children}
      <div className="year-range-track">
        <span
          className="year-range-span"
          style={{ left: `calc${yearAt(from)}`, right: `calc(100% - ${yearAt(to)})` }}
        />
        <input
          className="year-range-input"
          type="range"
          min={first}
          max={last}
          step={1}
          value={from}
          aria-label={t('crash.yearFrom')}
          // Both handles at the far right: the left one must stay reachable.
          style={{ zIndex: from === last ? 2 : 1 }}
          onChange={(e) => onChange(Math.min(Number(e.target.value), to), to)}
        />
        <input
          className="year-range-input"
          type="range"
          min={first}
          max={last}
          step={1}
          value={to}
          aria-label={t('crash.yearUntil')}
          onChange={(e) => onChange(from, Math.max(Number(e.target.value), from))}
        />
      </div>
    </div>
  )
}

/** Who, which years and which injuries the collisions layer shows, with how many of each. */
export function CollisionLegend({ spots, collisions, busiestSpot, filters, onChange, basemap }: Props) {
  const { t, lang } = useI18n()
  // Collisions shown, by worst injury: those in the spots left on the map.
  const counts = useMemo(() => {
    if (!spots) return null
    const byInjury = { none: 0, minimal: 0, minor: 0, major: 0, fatal: 0 }
    for (const spot of spots) for (const p of spot.items) byInjury[p.severity]++
    return byInjury
  }, [spots])
  const colors = collisionColors(basemap)
  const number = (n: number) => n.toLocaleString(lang === 'fr' ? 'fr-CA' : 'en-CA')
  const shown = counts ? filters.severities.reduce((sum, s) => sum + counts[s], 0) : null

  const months = useMemo(
    () =>
      collisions
        ? countByMonth(
            collisions.map((c) => c.props),
            filters,
          )
        : null,
    [collisions, filters],
  )
  const changeYears = (from: number, to: number) => onChange({ ...filters, from, to })

  const toggle = <T,>(list: readonly T[], value: T): T[] =>
    list.includes(value) ? list.filter((v) => v !== value) : [...list, value]

  return (
    <div className="collision-legend">
      <div className="collision-parties">
        {COLLISION_PARTIES.map((party) => (
          <label key={party} className="check">
            <input
              type="checkbox"
              checked={filters.parties.includes(party)}
              onChange={() => onChange({ ...filters, parties: toggle(filters.parties, party) })}
            />
            {t(`crash.${party}`)}
          </label>
        ))}
      </div>
      <YearRange from={filters.from} to={filters.to} onChange={changeYears}>
        {months && <Timeline counts={months} from={filters.from} to={filters.to} onChange={changeYears} />}
      </YearRange>
      <CollisionConditions collisions={collisions} filters={filters} onChange={onChange} basemap={basemap} />
      <label className="collision-min">
        <span>
          {filters.minCount <= 1
            ? t('crash.everySpot')
            : t('crash.minCount').replace('{count}', number(filters.minCount))}
        </span>
        {/* Dragged right, only the places where collisions keep happening stay on the map. */}
        <span className="collision-min-row">
          <SpotDot count={1} color={colors.minor} />
          <input
            className="collision-min-range"
            type="range"
            min={1}
            max={Math.max(2, busiestSpot)}
            step={1}
            value={Math.min(filters.minCount, Math.max(2, busiestSpot))}
            onChange={(e) => onChange({ ...filters, minCount: Number(e.target.value) })}
          />
          <SpotDot count={busiestSpot} color={colors.minor} />
        </span>
      </label>
      {shown !== null && spots && (
        <p className="collision-total">
          {t('crash.shown').replace('{count}', number(shown)).replace('{spots}', number(spots.length))}
        </p>
      )}
      <p className="footnote">
        {t('crash.source')
          .replace('{first}', String(COLLISION_YEARS.first))
          .replace('{last}', String(COLLISION_YEARS.last))}
      </p>
    </div>
  )
}
