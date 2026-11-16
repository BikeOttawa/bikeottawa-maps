import type { Closure } from '../construction'
import { isMessageKey, useI18n } from '../i18n'
import { type BasemapId, constructionColors } from '../layers'

type Props = { onClose: () => void; basemap: BasemapId } & (
  | { project: Record<string, unknown>; closure?: undefined }
  | { closure: Closure; project?: undefined }
)

/** The City's notes stop mid-sentence at its field's length: show that they go on. */
const cutShort = (text: string) => (/[.!?)»"]$/.test(text) ? text : `${text}…`)

function CloseButton({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  return (
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
  )
}

/**
 * A construction project from the City's forecast (its type, when, what it
 * does to traffic, its page), or a closure on its traffic map (what is closed,
 * from when to when).
 */
export function ConstructionCard({ project, closure, onClose, basemap }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const label = (key: string) => (isMessageKey(key) ? t(key) : null)

  if (closure) {
    // The City writes local date-times; a range reads "Mar 23 – Dec 1, 2026".
    const day = (text?: string) => (text ? new Date(text) : null)
    const [start, end] = [day(closure.start), day(closure.end)]
    const format = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' })
    const when = start && end ? format.formatRange(start, end) : start ? format.format(start) : null
    const facts = [
      { label: t('construction.lanes'), value: closure.lanes ?? null },
      { label: t('construction.detour'), value: closure.detour ?? null },
      { label: t('construction.by'), value: label(`construction.by.${closure.source}`) ?? closure.source ?? null },
    ]
    return (
      <section className="feature-card" aria-live="polite">
        <header>
          <div className="feature-title">
            <h2>{closure.headline || t('construction.closure')}</h2>
            {when && <p>{when}</p>}
          </div>
          <CloseButton onClose={onClose} />
        </header>
        {closure.message && <p className="construction-message">{closure.message}</p>}
        <dl>
          {facts
            .filter((fact) => fact.value)
            .map((fact) => (
              <div key={fact.label}>
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            ))}
        </dl>
        {closure.url && (
          <p className="feature-links">
            <a href={closure.url} target="_blank" rel="noopener noreferrer">
              {t('construction.more')}
            </a>
          </p>
        )}
      </section>
    )
  }

  const p = project ?? {}
  const timing = String(p.timing ?? '')
  const type = String((lang === 'fr' ? p.typeFr : p.type) ?? p.type ?? '')
  // Only a real web page: the City's field also holds internal codes.
  const page = String((lang === 'fr' ? p.urlFr : p.url) ?? p.url ?? '')
  const url = /^https?:\/\//i.test(page) ? page : ''
  const color = constructionColors(basemap)[timing as keyof ReturnType<typeof constructionColors>]
  const metres = Number(p.metres)
  const length =
    metres >= 1000
      ? `${(metres / 1000).toLocaleString(locale, { maximumFractionDigits: 1 })} km`
      : metres > 0
        ? `${Math.round(metres / 10) * 10} m`
        : null
  const facts = [
    { label: t('construction.work'), value: label(`construction.kind.${p.kind}`) },
    { label: t('construction.on'), value: p.street ? String(p.street) : null },
    { label: t('construction.length'), value: length },
    { label: t('construction.traffic'), value: p.impacts ? cutShort(String(p.impacts)) : null },
    { label: t('construction.notes'), value: p.notes ? cutShort(String(p.notes)) : null },
  ]
  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{type || t('layer.construction')}</h2>
          <p>
            {color && <span className="swatch dot construction-dot" style={{ background: color }} />}
            {label(`construction.timing.${timing}`)}
          </p>
        </div>
        <CloseButton onClose={onClose} />
      </header>
      <dl>
        {facts
          .filter((fact) => fact.value)
          .map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
      </dl>
      {url && (
        <p className="feature-links">
          <a href={url} target="_blank" rel="noopener noreferrer">
            {t('construction.project')}
          </a>
          {/* Whose page it is: the City's, or a utility's such as Enbridge. */}
          <span>{new URL(url).hostname.replace(/^www\./, '')}</span>
        </p>
      )}
    </section>
  )
}
