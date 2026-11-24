import { type ReactNode, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { osmViewUrl } from '../hash'
import { useI18n } from '../i18n'
import { REGION } from '../region'

const { join, volunteer, donate } = REGION.org ?? {}
/** Joining is offered when the region's group has pages to join, volunteer and donate. */
const GROUP_LINKS = join && volunteer && donate ? { join, volunteer, donate } : null

const WAYS = ['edit', 'phone', 'photos', 'ideas', ...(GROUP_LINKS ? (['join'] as const) : [])] as const

const LINKS: Record<string, string> = {
  streetcomplete: 'https://streetcomplete.app/',
  everydoor: 'https://every-door.app/',
  fotoshi: 'https://fotoshi.com/',
  mapillary: 'https://www.mapillary.com/mobile-apps',
  // The list, which anyone can read; a new issue asks to sign in first.
  issue: `${REGION.repo}/issues`,
  ...GROUP_LINKS,
}

/** Text with each `[words](key)` made a link to `links[key]`. */
function linked(text: string, links: Record<string, string>): ReactNode[] {
  const parts = text.split(/\[([^\]]+)\]\((\w+)\)/)
  return parts.map((part, i) =>
    i % 3 === 0 ? (
      part
    ) : i % 3 === 1 ? (
      <a key={parts[i + 1]} href={links[parts[i + 1]]} target="_blank" rel="noopener noreferrer">
        {part}
      </a>
    ) : null,
  )
}

/** A link that opens a card of ways to make the maps better. */
export function HowToHelp() {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className="link-button" onClick={() => setOpen(true)}>
        {t('help')}
      </button>
      {/* In the body: a dialog cannot sit in the footnote's paragraph. */}
      {open && createPortal(<HelpCard onClose={() => setOpen(false)} />, document.body)}
    </>
  )
}

function HelpCard({ onClose }: { onClose: () => void }) {
  const { t } = useI18n()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal()
  }, [])
  // The editor opens where the map is.
  const links = { ...LINKS, edit: osmViewUrl(window.location.hash, 'edit') }
  return (
    // Escape closes it too; a click outside the card lands on the dialog itself.
    // biome-ignore lint/a11y/useKeyWithClickEvents: the dialog handles Escape
    <dialog
      ref={dialog}
      className="help-dialog"
      aria-labelledby="help-title"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
    >
      <div className="help-card">
        <header>
          <h2 id="help-title">{t('help')}</h2>
          <button
            type="button"
            className="feature-close"
            aria-label={t('close')}
            onClick={() => dialog.current?.close()}
          >
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
        <p className="help-intro">{t('help.intro')}</p>
        <ul className="help-ways">
          {WAYS.map((way) => (
            <li key={way}>
              <h3>{t(`help.${way}`).replace('{org}', REGION.org?.name ?? '')}</h3>
              <p>{linked(t(`help.${way}.text`), links)}</p>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  )
}
