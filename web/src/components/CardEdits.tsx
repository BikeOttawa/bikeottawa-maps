import { lazy, Suspense, useState } from 'react'
import { OSM_CLIENT_ID, OSM_URL } from '../config'
import type { EditKind } from '../editFields'
import { type MessageKey, useI18n } from '../i18n'
import { EditIcon, NoteIcon } from './icons'

// The forms, the OSM sign-in and the API load only when a form is opened.
const TagEditor = lazy(() => import('./EditForms').then((m) => ({ default: m.TagEditor })))
const NoteForm = lazy(() => import('./EditForms').then((m) => ({ default: m.NoteForm })))

interface Props {
  /** The feature in OSM: "way/123". */
  path: string
  at: [number, number]
  /** None: notes only. */
  edit: EditKind | null
  /** Told after a save, so the live tags are fetched again. */
  onSaved: () => void
  /** The changeset the feature was just added in, to say so. */
  added?: number
}

/**
 * Under a card: fixing its details in OSM, as the person signed in, and
 * notes for what they cannot fix. Give it a `key` of the path, so another
 * feature starts closed.
 */
export function CardEdits({ path, at, edit, onSaved, added }: Props) {
  const { t } = useI18n()
  const [open, setOpen] = useState<'edit' | 'note' | null>(null)
  const [done, setDone] = useState<{ text: MessageKey; link: MessageKey; href: string } | null>(() =>
    added === undefined ? null : { text: 'add.saved', link: 'edit.changeset', href: `${OSM_URL}/changeset/${added}` },
  )

  const loading = <p className="footnote">{t('loading')}</p>
  if (open === 'edit' && edit) {
    return (
      <Suspense fallback={loading}>
        <TagEditor
          path={path}
          kind={edit}
          onClose={(changeset) => {
            setOpen(null)
            if (changeset === null) return
            setDone({ text: 'edit.saved', link: 'edit.changeset', href: `${OSM_URL}/changeset/${changeset}` })
            onSaved()
          }}
        />
      </Suspense>
    )
  }
  if (open === 'note') {
    return (
      <Suspense fallback={loading}>
        <NoteForm
          path={path}
          at={at}
          onClose={(note) => {
            setOpen(null)
            if (note !== null) setDone({ text: 'note.sent', link: 'note.view', href: `${OSM_URL}/note/${note}` })
          }}
        />
      </Suspense>
    )
  }
  const start = (form: 'edit' | 'note') => {
    setDone(null)
    setOpen(form)
  }
  return (
    <div className="card-edits">
      {done && (
        <p className="card-edit-done" role="status">
          {t(done.text)}{' '}
          <a href={done.href} target="_blank" rel="noopener noreferrer">
            {t(done.link)}
          </a>
        </p>
      )}
      <div className="card-edit-buttons">
        {edit && OSM_CLIENT_ID && (
          <button type="button" className="card-edit-open" onClick={() => start('edit')}>
            <EditIcon />
            {t('edit')}
          </button>
        )}
        <button type="button" className="card-edit-open" onClick={() => start('note')}>
          <NoteIcon />
          {t('note')}
        </button>
      </div>
    </div>
  )
}
