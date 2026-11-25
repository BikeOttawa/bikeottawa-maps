import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { AddedPlace } from '../addedPlaces'
import { OSM_CLIENT_ID, OSM_URL } from '../config'
import { type EditKind, editKind, fieldValues, newPlaceTags, placeThing, type TagField } from '../editFields'
import { isMessageKey, type MessageKey, type Translate, useI18n } from '../i18n'
import { osm, osmUser, SignInCancelled, signIn, signOut, subscribeOsmUser } from '../osmAuth'
import { changedTags, EditError, noteText, type OsmElement, placeNoteText } from '../osmEdit'
import { PLACE_GROUP_IDS, PLACE_KINDS, type PlaceKind, placeGroup } from '../places'

/**
 * The forms under a card: its details, signed in to OSM, and a note; and the
 * new place's. Loaded only once one is opened, with the OSM sign-in and API
 * (see CardEdits).
 */

const useOsmUser = () => useSyncExternalStore(subscribeOsmUser, osmUser)

/** A value of the list as the form shows it: numbers with their unit, the rest by name. */
function valueName(field: TagField, value: string, t: Translate, locale: string): string {
  if (field.unit !== undefined && /^\d+(\.\d+)?$/.test(value)) {
    const number = Number(value).toLocaleString(locale)
    return field.unit ? `${number}\u00a0${field.unit}` : number
  }
  const key = `${field.names ?? ''}${value}`
  return field.names !== undefined && isMessageKey(key) ? t(key) : value
}

/** A list to pick from for each field, showing the feature's own value until another is picked. */
function TagFields({
  fields,
  tags,
  picks,
  onPick,
  unset,
}: {
  fields: readonly TagField[]
  tags: Record<string, string>
  picks: Record<string, string>
  onPick: (key: string, value: string) => void
  /** What a tag the feature lacks is called. */
  unset: MessageKey
}) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  return fields.map((field) => {
    const current: string | undefined = tags[field.key]
    if (field.hint) {
      return (
        <label key={field.key}>
          <span className="card-edit-name">{t(field.label)}</span>
          <input
            type="text"
            maxLength={255}
            value={picks[field.key] ?? current ?? ''}
            placeholder={t(field.hint)}
            onChange={(event) => onPick(field.key, event.target.value)}
          />
        </label>
      )
    }
    return (
      <label key={field.key}>
        <span className="card-edit-name">{t(field.label)}</span>
        <select value={picks[field.key] ?? current ?? ''} onChange={(event) => onPick(field.key, event.target.value)}>
          {current === undefined && <option value="">{t(unset)}</option>}
          {fieldValues(field, current).map((value) => (
            <option key={value} value={value}>
              {/* A value not in the list is shown as it is in OSM. */}
              {field.values.includes(value) ? valueName(field, value, t, locale) : value}
            </option>
          ))}
        </select>
      </label>
    )
  })
}

export function TagEditor({
  path,
  kind,
  onClose,
}: {
  path: string
  kind: EditKind
  onClose: (changeset: number | null) => void
}) {
  const { t } = useI18n()
  const user = useOsmUser()
  const [element, setElement] = useState<OsmElement | null>(null)
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'loading' | 'ready' | 'saving' | 'loadError'>('loading')
  const [notice, setNotice] = useState<'edit.conflict' | 'edit.saveError' | null>(null)
  // Bumped to load the feature again, after someone else changed it.
  const [loads, setLoads] = useState(0)
  const signedIn = user !== null

  // biome-ignore lint/correctness/useExhaustiveDependencies: loads asks for a fresh copy
  useEffect(() => {
    if (!signedIn) return
    let live = true
    setStatus('loading')
    osm.load(path).then(
      (loaded) => {
        if (!live) return
        setElement(loaded)
        setPicks({})
        setStatus('ready')
      },
      () => live && setStatus('loadError'),
    )
    return () => {
      live = false
    }
  }, [signedIn, path, loads])

  const changes = element ? changedTags(element.tags, picks) : {}
  const changed = Object.keys(changes).length > 0

  async function save() {
    if (!element || !changed) return
    setStatus('saving')
    setNotice(null)
    try {
      const { changeset } = await osm.save(element, changes, kind.thing)
      onClose(changeset)
    } catch (error) {
      const reason = error instanceof EditError ? error.reason : 'failed'
      if (reason === 'conflict') {
        setNotice('edit.conflict')
        setLoads((n) => n + 1)
      } else {
        // Signed out when OSM refused the token: the sign-in shows instead.
        if (reason !== 'auth') setNotice('edit.saveError')
        setStatus('ready')
      }
    }
  }

  if (!user) {
    return (
      <div className="card-edit">
        <h3>{t('edit')}</h3>
        <SignIn />
        <div className="card-edit-actions">
          <button type="button" className="card-edit-action" onClick={() => onClose(null)}>
            {t('edit.cancel')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <form
      className="card-edit"
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
    >
      <h3>{t('edit')}</h3>
      {notice && (
        <p className="card-edit-error" role="alert">
          {t(notice)}
        </p>
      )}
      {status === 'loadError' ? (
        <p className="card-edit-error" role="alert">
          {t('edit.loadError')}
        </p>
      ) : !element || status === 'loading' ? (
        <p className="footnote">{t('loading')}</p>
      ) : (
        <div className="card-edit-fields">
          <TagFields
            fields={kind.fields}
            tags={element.tags}
            picks={picks}
            onPick={(key, value) => setPicks({ ...picks, [key]: value })}
            unset="edit.unset"
          />
        </div>
      )}
      <div className="card-edit-actions">
        <button type="button" className="card-edit-action" onClick={() => onClose(null)}>
          {t('edit.cancel')}
        </button>
        <button type="submit" className="card-edit-action primary" disabled={status !== 'ready' || !changed}>
          {status === 'saving' ? t('edit.saving') : t('edit.save')}
        </button>
      </div>
      <p className="footnote">
        {t('edit.signedIn').replace('{name}', user.name ?? '…')} ·{' '}
        <button type="button" className="link-button" onClick={signOut}>
          {t('edit.signOut')}
        </button>
      </p>
    </form>
  )
}

/** Signing in from a click, and how it is going. */
function useSignIn() {
  const [state, setState] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [reason, setReason] = useState('')
  // The map cannot tell when the popup is closed, so the button stays: a click starts over.
  const attempt = useRef(0)
  const start = () => {
    const id = ++attempt.current
    const settle = (next: typeof state) => id === attempt.current && setState(next)
    setState('waiting')
    signIn().then(
      () => settle('idle'),
      (error) => {
        if (!(error instanceof SignInCancelled)) {
          console.warn('OSM sign-in failed:', error)
          if (id === attempt.current) setReason(String(error.message ?? error))
        }
        settle(error instanceof SignInCancelled ? 'idle' : 'error')
      },
    )
  }
  return { state, reason, start }
}

/** While signing in: where to finish it, or why it failed. */
function SignInState({ state, reason }: { state: 'idle' | 'waiting' | 'error'; reason: string }) {
  const { t } = useI18n()
  if (state === 'waiting') return <p className="footnote">{t('edit.signingIn')}</p>
  if (state === 'error') {
    return (
      <p className="card-edit-error" role="alert">
        {t('edit.signInError')} {reason && <small>({reason})</small>}
      </p>
    )
  }
  return null
}

function SignIn() {
  const { t } = useI18n()
  const { state, reason, start } = useSignIn()
  return (
    <>
      <p className="footnote">{t('edit.intro')}</p>
      <button type="button" className="card-edit-action primary" onClick={start}>
        {t('edit.signIn')}
      </button>
      <SignInState state={state} reason={reason} />
      <p className="footnote">
        <a href={`${OSM_URL}/user/new`} target="_blank" rel="noopener noreferrer">
          {t('edit.signUp')}
        </a>
      </p>
    </>
  )
}

/**
 * A new place at the pin: what it is and its details. Signed in, it goes on
 * OSM; without an account, to local mappers as a note.
 */
export function PlaceForm({
  at,
  shown,
  onKindChange,
  onAdded,
  onCancel,
}: {
  at: [number, number]
  /** The kinds ticked in the legend: those that can be added are the choices, or all when none is. */
  shown: readonly PlaceKind[]
  /** Told of the kind picked, the first one included. */
  onKindChange: (kind: PlaceKind) => void
  /** Told of the place added, with its changeset; or sent as a note, its `osm` the note's. */
  onAdded: (place: Omit<AddedPlace, 'added'>, changeset?: number) => void
  onCancel: () => void
}) {
  const { t } = useI18n()
  const user = useOsmUser()
  // As the legend was when the form opened: the kind picked is ticked there, which would leave it the only choice.
  const [choices] = useState(() => {
    const ticked = PLACE_KINDS.filter((option) => shown.includes(option))
    return ticked.length ? ticked : PLACE_KINDS
  })
  // None until one is picked, unless there is only one.
  const [kind, setKind] = useState<PlaceKind | null>(choices.length === 1 ? choices[0] : null)
  const [name, setName] = useState('')
  const [picks, setPicks] = useState<Record<string, string>>({})
  const [status, setStatus] = useState<'ready' | 'sending' | 'error'>('ready')
  const signingIn = useSignIn()
  const edit = kind && editKind('place', { kind })
  const adds = user !== null

  // biome-ignore lint/correctness/useExhaustiveDependencies: told of each new kind, not of each new callback
  useEffect(() => {
    if (kind) onKindChange(kind)
  }, [kind])

  async function send() {
    if (!kind) return
    const tags = newPlaceTags(kind, name, picks)
    setStatus('sending')
    try {
      if (adds) {
        const { id, changeset } = await osm.create(at, tags, placeThing(kind))
        onAdded({ osm: `node/${id}`, kind, at, tags }, changeset)
      } else {
        // The note's words go to mappers as they are, after the tags to add.
        const { note: words = '', ...rest } = tags
        const note = await osm.note(at, placeNoteText(rest, words))
        onAdded({ osm: `note/${note}`, kind, at, tags })
      }
    } catch (error) {
      // Signed out when OSM refused the token: the form turns to a note.
      setStatus(error instanceof EditError && error.reason === 'auth' ? 'ready' : 'error')
    }
  }

  return (
    <form
      className="card-edit"
      onSubmit={(event) => {
        event.preventDefault()
        send()
      }}
    >
      <p className="footnote">{t('add.hint')}</p>
      <div className="card-edit-fields">
        <label>
          <span className="card-edit-name">{t('add.kind')}</span>
          <select
            value={kind ?? ''}
            onChange={(event) => {
              setKind(event.target.value as PlaceKind)
              // Another kind has other details; the note stays.
              setPicks(({ note }): Record<string, string> => (note ? { note } : {}))
            }}
          >
            {!kind && (
              <option value="" disabled>
                {t('add.choose')}
              </option>
            )}
            {/* A long list is split as the legend is. */}
            {choices.length > 6
              ? PLACE_GROUP_IDS.map((group) => {
                  const inGroup = choices.filter((option) => placeGroup(option) === group)
                  return inGroup.length ? (
                    <optgroup key={group} label={t(`group.${group}`)}>
                      {inGroup.map((option) => (
                        <option key={option} value={option}>
                          {t(`place.${option}`)}
                        </option>
                      ))}
                    </optgroup>
                  ) : null
                })
              : choices.map((option) => (
                  <option key={option} value={option}>
                    {t(`place.${option}`)}
                  </option>
                ))}
          </select>
        </label>
        {kind && (
          <label>
            <span className="card-edit-name">{t('add.name')}</span>
            <input
              type="text"
              value={name}
              maxLength={255}
              placeholder={t('add.optional')}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
        )}
        <TagFields
          fields={edit?.fields ?? []}
          tags={{}}
          picks={picks}
          onPick={(key, value) => setPicks({ ...picks, [key]: value })}
          unset="add.unknown"
        />
      </div>
      {status === 'error' && (
        <p className="card-edit-error" role="alert">
          {t(adds ? 'edit.saveError' : 'note.error')}
        </p>
      )}
      <div className="card-edit-actions">
        <button type="button" className="card-edit-action" onClick={onCancel}>
          {t('edit.cancel')}
        </button>
        <button type="submit" className="card-edit-action primary" disabled={!kind || status === 'sending'}>
          {status === 'sending' ? t(adds ? 'add.saving' : 'note.sending') : t(adds ? 'add.save' : 'add.send')}
        </button>
      </div>
      {adds ? (
        <p className="footnote">
          {t('add.intro')} {t('edit.signedIn').replace('{name}', user.name ?? '…')} ·{' '}
          <button type="button" className="link-button" onClick={signOut}>
            {t('edit.signOut')}
          </button>
        </p>
      ) : (
        <>
          <p className="footnote">
            {t('add.asNote')}
            {OSM_CLIENT_ID && (
              <>
                {' '}
                <button type="button" className="link-button" onClick={signingIn.start}>
                  {t('add.signIn')}
                </button>
              </>
            )}
          </p>
          <SignInState state={signingIn.state} reason={signingIn.reason} />
        </>
      )}
    </form>
  )
}

export function NoteForm({
  path,
  at,
  onClose,
}: {
  path: string
  at: [number, number]
  onClose: (note: number | null) => void
}) {
  const { t } = useI18n()
  const user = useOsmUser()
  const [text, setText] = useState('')
  const [status, setStatus] = useState<'ready' | 'sending' | 'error'>('ready')

  async function send() {
    setStatus('sending')
    try {
      onClose(await osm.note(at, noteText(text, `${OSM_URL}/${path}`)))
    } catch {
      setStatus('error')
    }
  }

  return (
    <form
      className="card-edit"
      onSubmit={(event) => {
        event.preventDefault()
        if (text.trim()) send()
      }}
    >
      <h3>{t('note')}</h3>
      <textarea
        rows={3}
        maxLength={1800}
        value={text}
        aria-label={t('note')}
        placeholder={t('note.placeholder')}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="footnote">
        {t('note.intro')} {user ? t('note.as').replace('{name}', user.name ?? '…') : t('note.anonymous')}
      </p>
      {status === 'error' && (
        <p className="card-edit-error" role="alert">
          {t('note.error')}
        </p>
      )}
      <div className="card-edit-actions">
        <button type="button" className="card-edit-action" onClick={() => onClose(null)}>
          {t('edit.cancel')}
        </button>
        <button type="submit" className="card-edit-action primary" disabled={!text.trim() || status === 'sending'}>
          {status === 'sending' ? t('note.sending') : t('note.send')}
        </button>
      </div>
    </form>
  )
}
