import { lazy, Suspense } from 'react'
import type { AddedPlace } from '../addedPlaces'
import { useI18n } from '../i18n'
import type { PlaceKind } from '../places'

// The form, the OSM sign-in and the API load only when a place is added.
const PlaceForm = lazy(() => import('./EditForms').then((m) => ({ default: m.PlaceForm })))

interface Props {
  /** Where the pin is. */
  at: [number, number]
  /** The kinds ticked in the legend, which the place can be. */
  shown: readonly PlaceKind[]
  onKindChange: (kind: PlaceKind) => void
  /** Told of the place added, with its changeset; or sent as a note, its `osm` the note's. */
  onAdded: (place: Omit<AddedPlace, 'added'>, changeset?: number) => void
  onClose: () => void
}

/** Adding a place where the pin is, on OSM or as a note. */
export function AddPlaceCard({ at, shown, onKindChange, onAdded, onClose }: Props) {
  const { t } = useI18n()
  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <div className="feature-title">
          <h2>{t('add')}</h2>
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
      <Suspense fallback={<p className="footnote">{t('loading')}</p>}>
        <PlaceForm at={at} shown={shown} onKindChange={onKindChange} onAdded={onAdded} onCancel={onClose} />
      </Suspense>
    </section>
  )
}
