import { useI18n } from '../i18n'
import { spotSize } from '../map/pieImage'

/** The years a layer's data covers, and any the source never published. */
export interface Years {
  first: number
  last: number
  missing: readonly number[]
}

/** The slider's handles are this wide; their centres run from half of it in to half of it from the end. */
const HANDLE = 18

const MONTHS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12']

/** Where a year's handle centre sits along the slider, as CSS. */
const yearAt = ({ first, last }: Years, year: number) =>
  `(${HANDLE / 2}px + (100% - ${HANDLE}px) * ${(year - first) / (last - first)})`

/**
 * Counts month by month, each year's months over that year's place on the
 * slider: the years picked in the accent, the others grey. A year picks that
 * year alone; picked alone, it gives back every year.
 */
function Timeline({
  years,
  counts,
  label,
  from,
  to,
  onChange,
}: {
  years: Years
  counts: Map<string, number>
  label: string
  from: number
  to: number
  onChange: (from: number, to: number) => void
}) {
  const { t, lang } = useI18n()
  const { first, last, missing } = years
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const max = Math.max(1, ...counts.values())
  const band = `((100% - ${HANDLE}px) / ${last - first})`
  const month = (m: number) => new Date(2000, m, 1).toLocaleString(locale, { month: 'long' })
  const all = Array.from({ length: last - first + 1 }, (_, i) => first + i)
  return (
    <div className="timeline" role="img" aria-label={label}>
      {all.map((year) => {
        const style = { left: `calc(${yearAt(years, year)} - ${band} / 2)`, width: `calc(${band})` }
        const yearLabel = <span className="timeline-label">{year}</span>
        if (missing.includes(year)) {
          return (
            <div key={year} className="timeline-year missing" style={style} title={t('crash.notPublished')}>
              <span className="timeline-months" />
              {yearLabel}
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
            {yearLabel}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Years as one slider with two handles: two range inputs on one track, only
 * their handles taking the pointer, the span between them highlighted. With
 * counts by month (`2019-06`), a timeline of them sits above the track.
 */
export function YearRange({
  years,
  from,
  to,
  onChange,
  counts,
  timelineLabel,
}: {
  years: Years
  from: number
  to: number
  onChange: (from: number, to: number) => void
  counts: Map<string, number> | null
  timelineLabel: string
}) {
  const { t } = useI18n()
  const { first, last } = years
  return (
    <div className="year-range">
      <span>
        {t('crash.years')}
        {t('colon')}
        {from === to ? from : `${from} – ${to}`}
      </span>
      {counts && (
        <Timeline years={years} counts={counts} label={timelineLabel} from={from} to={to} onChange={onChange} />
      )}
      <div className="year-range-track">
        <span
          className="year-range-span"
          style={{ left: `calc${yearAt(years, from)}`, right: `calc(100% - ${yearAt(years, to)})` }}
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

/** A spot's circle at the slider's ends, sized against the busiest as the map does: 8 px for one item to 30 px. */
function SpotDot({ count, busiest, color }: { count: number; busiest: number; color: string }) {
  const r = 4 + 11 * spotSize(count, busiest)
  const size = Math.ceil(2 * r + 2)
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="spot-dot">
      <circle cx={size / 2} cy={size / 2} r={r} fill={color} stroke="#fff" />
    </svg>
  )
}

/** Dragged right, only the places where it keeps happening stay on the map. */
export function MinCountSlider({
  value,
  busiest,
  color,
  label,
  onChange,
}: {
  value: number
  /** The most at any one spot: the slider's top. */
  busiest: number
  color: string
  label: string
  onChange: (value: number) => void
}) {
  const top = Math.max(2, busiest)
  return (
    <label className="collision-min">
      <span>{label}</span>
      <span className="collision-min-row">
        <SpotDot count={1} busiest={busiest} color={color} />
        <input
          className="collision-min-range"
          type="range"
          min={1}
          max={top}
          step={1}
          value={Math.min(value, top)}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <SpotDot count={busiest} busiest={busiest} color={color} />
      </span>
    </label>
  )
}
