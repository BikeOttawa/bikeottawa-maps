import { useEffect, useState } from 'react'
import { isMessageKey, useI18n } from '../i18n'
import { streetViewUrl } from '../photos'
import { cityData } from '../region'
import { type TheftProps, theftPlace } from '../thefts'
import { CardPhoto } from './PlacePhoto'

interface Props {
  /** The thefts placed at the intersection, the most recent first; the card steps through them. */
  items: readonly TheftProps[]
  at: [number, number]
  onClose: () => void
}

/**
 * An intersection and the bikes taken near it, from the police's records. The
 * top is about the place: its name, a photo, what was taken there in all. A
 * line below, the thefts themselves, one at a time.
 */
export function TheftCard({ items, at, onClose }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  // What the region says of where its thefts are placed.
  const note = cityData('thefts')?.note?.[lang]
  const [index, setIndex] = useState(0)
  // A new spot starts again at its most recent theft.
  // biome-ignore lint/correctness/useExhaustiveDependencies: resets when the thefts change
  useEffect(() => setIndex(0), [items])
  const count = items.length
  const p = items[index] ?? items[0]
  const step = (by: number) => setIndex((i) => (i + by + count) % count)
  // The spot can be gone (the filters changed under it): nothing to show then.
  if (!p) return null
  const label = (key: string) => (isMessageKey(key) ? t(key) : null)
  const money = (n: number) =>
    n.toLocaleString(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
  const total = items.reduce((sum, item) => sum + (item.value ?? 0), 0)
  // The police put every theft here at the same intersection.
  const place = p.place ? theftPlace(p.place) : (p.area ?? t('theft.title'))
  const summary = [
    count === 1 ? t('theft.oneHere') : t('theft.manyHere').replace('{count}', count.toLocaleString(locale)),
    count > 1 && total ? t('theft.worth').replace('{value}', money(total)) : null,
  ]
    .filter(Boolean)
    .join(' · ')

  // Several bikes taken at once differ only by these: "Trek FSX4 · grey".
  const colourNames = (p.colour ?? []).map((c) => label(`colour.${c}`)).filter((c): c is string => Boolean(c))
  // Dates are local days; read them as such, not as UTC midnight.
  const date = new Date(`${p.date}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'medium' })
  const hour =
    p.hour === undefined ? null : new Date(2000, 0, 1, p.hour).toLocaleTimeString(locale, { hour: 'numeric' })
  // The same rows for every theft, each on one line, so stepping through them keeps the card's size.
  const facts: { label: string; value: string }[] = [
    { label: t('theftGroup.where'), value: label(`theft.where.${p.where}`) ?? t('condition.other') },
    {
      label: t('theft.when'),
      value: [label(`theft.time.${p.time}`), hour].filter(Boolean).join(', ') || t('unknown'),
    },
    {
      label: t('theftGroup.type'),
      value:
        [
          label(`theft.type.${p.type}`),
          [p.make, p.model].filter(Boolean).join(' '),
          colourNames.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(colourNames) : null,
        ]
          .filter(Boolean)
          .join(' · ') || t('unknown'),
    },
    { label: t('theftGroup.value'), value: p.value ? money(p.value) : t('theft.noValue') },
  ]

  return (
    <section className="feature-card theft-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{place}</h2>
          {p.place && p.area && <p>{p.area}</p>}
        </div>
        <button type="button" className="feature-close" aria-label={t('close')} onClick={onClose}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
      </header>
      <CardPhoto at={at} />
      <p className="theft-spot" title={note ? `${summary}. ${note}` : summary}>
        {summary}
      </p>
      <div className="theft-head">
        <h3>
          {t(p.recovered ? 'theft.title.recovered' : 'theft.title')}
          <span> · {date}</span>
        </h3>
        {count > 1 && (
          <div className="card-step">
            <button type="button" aria-label={t('theft.previous')} onClick={() => step(-1)}>
              ‹
            </button>
            <span>
              {index + 1} / {count}
            </span>
            <button type="button" aria-label={t('theft.next')} onClick={() => step(1)}>
              ›
            </button>
          </div>
        )}
      </div>
      <dl className="theft-facts">
        {facts.map((fact) => (
          <div key={fact.label}>
            <dt>{fact.label}</dt>
            <dd title={fact.value}>{fact.value}</dd>
          </div>
        ))}
      </dl>
      <p className="feature-links">
        <span>
          {t('viewIn')}{' '}
          <a href={streetViewUrl(at)} target="_blank" rel="noopener noreferrer">
            Street View
          </a>
        </span>
      </p>
    </section>
  )
}
