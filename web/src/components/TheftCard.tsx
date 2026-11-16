import { useEffect, useState } from 'react'
import { isMessageKey, useI18n } from '../i18n'
import { streetViewUrl } from '../photos'
import { type TheftProps, theftPlace } from '../thefts'
import { CardPhoto } from './PlacePhoto'

interface Props {
  /** The thefts placed at the intersection, the most recent first; the card steps through them. */
  items: readonly TheftProps[]
  at: [number, number]
  onClose: () => void
}

/** Details of the bikes taken near an intersection, from the police's records, one at a time. */
export function TheftCard({ items, at, onClose }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
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
  // Several bikes taken at once differ only by these: "Trek FSX4 · grey".
  const colourNames = (p.colour ?? []).map((c) => label(`colour.${c}`)).filter((c): c is string => Boolean(c))
  // Dates are local days; read them as such, not as UTC midnight.
  const date = new Date(`${p.date}T12:00:00`).toLocaleDateString(locale, { dateStyle: 'long' })
  const hour =
    p.hour === undefined ? null : new Date(2000, 0, 1, p.hour).toLocaleTimeString(locale, { hour: 'numeric' })
  const facts: { label: string; value: string | null; title?: string }[] = [
    { label: t('theftGroup.where'), value: label(`theft.where.${p.where}`) },
    { label: t('theft.when'), value: [label(`theft.time.${p.time}`), hour].filter(Boolean).join(', ') || null },
    {
      label: t('theftGroup.type'),
      value:
        [
          label(`theft.type.${p.type}`),
          [p.make, p.model].filter(Boolean).join(' '),
          colourNames.length ? new Intl.ListFormat(locale, { type: 'conjunction' }).format(colourNames) : null,
        ]
          .filter(Boolean)
          .join(' · ') || null,
    },
    {
      label: t('theftGroup.value'),
      value: p.value
        ? p.value.toLocaleString(locale, { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 })
        : null,
    },
    {
      label: t('theft.near'),
      value: [p.place && theftPlace(p.place), p.area].filter(Boolean).join(', ') || null,
      title: t('theft.nearHint'),
    },
  ]

  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{t(p.recovered ? 'theft.title.recovered' : 'theft.title')}</h2>
          <p>{date}</p>
        </div>
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
      <dl>
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <div key={fact.label} title={fact.title}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
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
