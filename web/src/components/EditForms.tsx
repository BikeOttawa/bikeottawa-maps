import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { OSM_URL } from '../config'
import { type EditKind, fieldValues, type TagField } from '../editFields'
import { isMessageKey, type Translate, useI18n } from '../i18n'
import { osm, osmUser, SignInCancelled, signIn, signOut, subscribeOsmUser } from '../osmAuth'
import { changedTags, EditError, noteText, type OsmElement } from '../osmEdit'

/**
 * The forms under a card: its details, signed in to OSM, and a note. Loaded
 * only once one is opened, with the OSM sign-in and API (see CardEdits).
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

export function TagEditor({
  path,
  kind,
  onClose,
}: {
  path: string
  kind: EditKind
  onClose: (changeset: number | null) => void
}) {
  const { t, lang } = useI18n()
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

  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
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
          {kind.fields.map((field) => {
            const current: string | undefined = element.tags[field.key]
            return (
              <label key={field.key}>
                <span className="card-edit-name">{t(field.label)}</span>
                <select
                  value={picks[field.key] ?? current ?? ''}
                  onChange={(event) => setPicks({ ...picks, [field.key]: event.target.value })}
                >
                  {current === undefined && <option value="">{t('edit.unset')}</option>}
                  {fieldValues(field, current).map((value) => (
                    <option key={value} value={value}>
                      {/* A value not in the list is shown as it is in OSM. */}
                      {field.values.includes(value) ? valueName(field, value, t, locale) : value}
                    </option>
                  ))}
                </select>
              </label>
            )
          })}
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

function SignIn() {
  const { t } = useI18n()
  const [state, setState] = useState<'idle' | 'waiting' | 'error'>('idle')
  const [reason, setReason] = useState('')
  // The map cannot tell when the popup is closed, so the button stays: a click starts over.
  const attempt = useRef(0)
  return (
    <>
      <p className="footnote">{t('edit.intro')}</p>
      <button
        type="button"
        className="card-edit-action primary"
        onClick={() => {
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
        }}
      >
        {t('edit.signIn')}
      </button>
      {state === 'waiting' && <p className="footnote">{t('edit.signingIn')}</p>}
      {state === 'error' && (
        <p className="card-edit-error" role="alert">
          {t('edit.signInError')} {reason && <small>({reason})</small>}
        </p>
      )}
      <p className="footnote">
        <a href={`${OSM_URL}/user/new`} target="_blank" rel="noopener noreferrer">
          {t('edit.signUp')}
        </a>
      </p>
    </>
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
