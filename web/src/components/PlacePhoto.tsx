import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FOTOSHI_KEY, MAPILLARY_TOKEN } from '../config'
import { type Lang, useI18n } from '../i18n'
import {
  directImage,
  directPhoto,
  type FotoshiShot,
  fetchFotoshiPhotos,
  fetchMapillaryPhoto,
  findNearbyMapillary,
  fotoshiIds,
  fotoshiOsmId,
  fotoshiPhoto,
  mapillaryId,
  type NearbyImage,
  type Photo,
} from '../photos'

/** "Jun 2019": when a photo was taken. */
function takenOn(photo: Photo, lang: Lang): string | null {
  return photo.takenAt
    ? new Date(photo.takenAt).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', {
        month: 'short',
        year: 'numeric',
      })
    : null
}

/** Starts loading an image so it shows at once when its turn comes. */
function preload(photo: Photo | null) {
  if (photo) new Image().src = photo.largeUrl
}

/** A photo the larger view can step to: one already known, or a Mapillary id loaded when needed. */
interface Extra {
  id: string
  photo?: Photo
  /** Metres from the place, for a photo taken nearby. */
  distance?: number
}

/**
 * The card's photos, in order (the first is the card's), and a line about
 * each. Photos come in as their sources answer, so the list can grow and its
 * first change.
 */
function PhotoFigure({
  items,
  noteFor,
  onBroken,
}: {
  items: readonly Extra[]
  noteFor: (item: Extra) => string
  onBroken: () => void
}) {
  const { t, lang } = useI18n()
  const photo = items[0]?.photo ?? null
  const count = items.length
  // The photo the larger view shows, by id, so a photo coming in ahead of it
  // does not move it; null when the view is closed.
  const [viewing, setViewing] = useState<string | null>(null)
  const found = viewing === null ? -1 : items.findIndex((item) => item.id === viewing)
  const index = found < 0 ? null : found
  const [shown, setShown] = useState<Photo | null>(null)
  const loads = useRef(new Map<string, Promise<Photo | null>>())
  const latest = useRef({ items, index })
  latest.current = { items, index }

  // The photo at a position, loaded once and kept.
  const load = (at: number): Promise<Photo | null> => {
    const item = latest.current.items[at]
    if (item?.photo) return Promise.resolve(item.photo)
    if (!item || !MAPILLARY_TOKEN) return Promise.resolve(null)
    let pending = loads.current.get(item.id)
    if (!pending) {
      pending = fetchMapillaryPhoto(item.id, MAPILLARY_TOKEN).catch(() => null)
      loads.current.set(item.id, pending)
    }
    return pending
  }

  // Shown when the view opens or steps; photos coming in meanwhile leave it be.
  // biome-ignore lint/correctness/useExhaustiveDependencies: load reads the current photos
  useEffect(() => {
    const at = latest.current.index
    if (at === null) return
    let current = true
    setShown(latest.current.items[at]?.photo ?? null)
    load(at).then((found) => {
      if (current) setShown(found)
    })
    // Get the neighbours ready, so stepping either way is instant.
    const n = latest.current.items.length
    if (n > 1) for (const next of [(at + 1) % n, (at - 1 + n) % n]) load(next).then(preload)
    return () => {
      current = false
    }
  }, [viewing])

  const step = (by: number) => {
    const { items: now, index: at } = latest.current
    if (at !== null && now.length > 1) setViewing(now[(at + by + now.length) % now.length].id)
  }

  // Esc closes the larger view; the arrow keys step through the photos.
  // biome-ignore lint/correctness/useExhaustiveDependencies: step reads the current photos
  useEffect(() => {
    if (viewing === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setViewing(null)
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [viewing === null])

  // How far away, when it was taken, then the credit: short enough for one line in a card.
  const captionOf = (p: Photo | null, line?: string) =>
    [line, p && takenOn(p, lang), p?.credit].filter(Boolean).join(' · ')
  const note = items[0] ? noteFor(items[0]) : undefined
  const viewerNote = index === null ? note : noteFor(items[index])

  return (
    <figure className="place-photo">
      {photo ? (
        <button
          type="button"
          className="place-photo-open"
          title={t('photoEnlarge')}
          onClick={() => setViewing(items[0].id)}
        >
          {/* A broken link hides the photo rather than showing a broken image. */}
          <img src={photo.url} alt={t('photoAlt')} onError={onBroken} />
          {count > 1 && (
            <span className="place-photo-more" title={t('photoMore').replace('{count}', String(count - 1))}>
              +{count - 1}
            </span>
          )}
        </button>
      ) : (
        <span className="place-photo-loading" />
      )}
      <figcaption>{captionOf(photo, note)}</figcaption>
      {photo &&
        index !== null &&
        createPortal(
          // biome-ignore lint/a11y/useKeyWithClickEvents: Esc closes it, handled above
          <div className="photo-viewer" role="dialog" aria-label={t('photoAlt')} onClick={() => setViewing(null)}>
            {shown ? <img src={shown.largeUrl} alt={t('photoAlt')} /> : <span className="photo-viewer-loading" />}
            <p>
              {count > 1 && `${index + 1} / ${count} · `}
              {captionOf(shown, viewerNote)}
              {shown && (
                <>
                  {' · '}
                  <a href={shown.link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                    {t('photoSource')}
                  </a>
                </>
              )}
            </p>
            {count > 1 && (
              <>
                <button
                  type="button"
                  className="photo-viewer-step prev"
                  aria-label={t('photoPrev')}
                  onClick={(e) => {
                    e.stopPropagation()
                    step(-1)
                  }}
                >
                  ‹
                </button>
                <button
                  type="button"
                  className="photo-viewer-step next"
                  aria-label={t('photoNext')}
                  onClick={(e) => {
                    e.stopPropagation()
                    step(1)
                  }}
                >
                  ›
                </button>
              </>
            )}
            <button type="button" className="photo-viewer-close" aria-label={t('close')}>
              ×
            </button>
          </div>,
          document.body,
        )}
    </figure>
  )
}

/** What a card's sources have answered so far; a source not yet in is undefined. */
interface Answers {
  fotoshi?: FotoshiShot[]
  /** The place's own Mapillary photo, from its tag. */
  tagged?: Photo | null
  near?: NearbyImage[]
  /** Photos fetched for nearby Mapillary images, by id. */
  nearPhotos: Map<string, Photo>
}

/**
 * A card's photos in order, from what has answered so far: Fotoshi's (a
 * place's linked and tagged photos, or those taken around a point), the
 * place's Mapillary tag and image tag, then Mapillary's nearby, leaving out
 * the place's own and near-copies of it.
 */
function arrange(
  got: Answers,
  own: { named: Photo[]; direct: Photo | null },
  place: boolean,
  tagged: string | null,
): Extra[] {
  const items: Extra[] = []
  // A photo both linked and tagged shows once, with the credit Fotoshi gives it.
  const add = (item: Extra) => {
    if (!items.some((other) => other.id === item.id)) items.push(item)
  }
  for (const { photo, distance } of got.fotoshi ?? []) add({ id: photo.link, photo, ...(!place && { distance }) })
  for (const photo of own.named) add({ id: photo.link, photo })
  if (got.tagged) add({ id: got.tagged.link, photo: got.tagged })
  if (own.direct) add({ id: own.direct.link, photo: own.direct })
  const run = got.tagged?.sequence
  for (const near of got.near ?? []) {
    if (near.id === tagged || (run && near.sequence === run)) continue
    const photo = got.nearPhotos.get(near.id)
    add({ id: near.id, distance: near.distance, ...(photo && { photo }) })
  }
  return items
}

/**
 * Photos for a card, in order: Fotoshi's, then the place's own (its Mapillary
 * and image tags), then the Mapillary photos taken nearby. A place asks
 * Fotoshi by its OSM object; anything else, a street, a barrier, a spot, by
 * where it is (within 30 m). The sources are asked at once and each shows as it
 * answers: one ahead of the photo shown takes its place. They are only looked
 * up once the card is open, and nothing shows when there are none.
 */
export function CardPhoto({ at, props }: { at: readonly [number, number]; props?: Record<string, unknown> }) {
  const { t } = useI18n()
  const [lon, lat] = at
  const tagged = props && MAPILLARY_TOKEN ? mapillaryId(props.mapillary) : null
  const direct = props ? directImage(props.image) : null
  // Joined, so the effect below sees a change only when the ids change.
  const fotoshi = props ? fotoshiIds(props['image:fotoshi']).join(';') : ''
  const osmId = props ? fotoshiOsmId(props.osm) : null
  const [items, setItems] = useState<Extra[]>(NO_PHOTOS)
  const [state, setState] = useState<'loading' | 'shown' | 'none'>('loading')

  useEffect(() => {
    const token = MAPILLARY_TOKEN
    const key = FOTOSHI_KEY
    const controller = new AbortController()
    const { signal } = controller
    const got: Answers = { nearPhotos: new Map() }
    const own = { named: fotoshiIds(fotoshi).map(fotoshiPhoto), direct: direct ? directPhoto(direct) : null }
    let pending = 0
    const update = () => {
      if (signal.aborted) return
      const list = arrange(got, own, osmId !== null, tagged)
      // The first needs its photo to show; until then, the grey box.
      const ready = list[0]?.photo !== undefined
      setItems(ready ? list : NO_PHOTOS)
      setState(ready ? 'shown' : pending ? 'loading' : 'none')
    }
    // Each answer goes in as it comes, and the photos are arranged again; one that fails adds nothing.
    const ask = <T,>(request: Promise<T>, keep: (value: T) => void) => {
      pending++
      request
        .then(keep, () => {})
        .finally(() => {
          pending--
          update()
        })
    }
    if (key) {
      ask(fetchFotoshiPhotos(osmId ? { osmId } : { at: [lon, lat] }, key, signal), (shots) => {
        got.fotoshi = shots
      })
    }
    if (tagged && token) {
      ask(fetchMapillaryPhoto(tagged, token, signal), (photo) => {
        got.tagged = photo
      })
    }
    if (token) {
      ask(findNearbyMapillary([lon, lat], token, signal), (near) => {
        got.near = near
        // The closest is the card's photo unless one ahead of it has come: fetch it now.
        const closest = near.find((n) => n.id !== tagged)
        const ahead = own.named.length > 0 || own.direct || got.fotoshi?.length || got.tagged
        if (closest && !ahead) {
          ask(fetchMapillaryPhoto(closest.id, token, signal), (photo) => {
            if (photo) got.nearPhotos.set(closest.id, photo)
          })
        }
      })
    }
    update()
    return () => controller.abort()
  }, [lon, lat, tagged, direct, fotoshi, osmId])

  if (state === 'none' || (!MAPILLARY_TOKEN && !FOTOSHI_KEY && !direct && !fotoshi)) return null
  const metres = (distance: number) => String(Math.max(1, Math.round(distance)))
  return (
    // A new place starts the larger view and what it loaded afresh.
    <PhotoFigure
      key={`${lon},${lat}`}
      items={items}
      noteFor={(item) =>
        item.distance === undefined ? '' : t('photoDistance').replace('{distance}', metres(item.distance))
      }
      onBroken={() => setState('none')}
    />
  )
}

const NO_PHOTOS: Extra[] = []
