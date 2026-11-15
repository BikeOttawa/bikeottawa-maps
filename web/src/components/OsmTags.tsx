import { useEffect, useState } from 'react'
import { useI18n } from '../i18n'

/**
 * A feature's tags as they are in OSM now, fetched from the OSM API only once
 * opened. Being live, they show an edit before the tiles are rebuilt with it.
 * Give it a `key` of its path, so another feature starts closed.
 */
export function OsmTags({ path }: { path: string }) {
  const { t } = useI18n()
  const [requested, setRequested] = useState(false)
  const [tags, setTags] = useState<[string, string][] | 'error' | null>(null)

  useEffect(() => {
    if (!requested) return
    const controller = new AbortController()
    fetch(`https://api.openstreetmap.org/api/0.6/${path}.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`OSM API: ${res.status}`)
        return res.json()
      })
      .then((data: { elements?: { tags?: Record<string, string> }[] }) =>
        setTags(Object.entries(data.elements?.[0]?.tags ?? {}).sort(([a], [b]) => a.localeCompare(b))),
      )
      .catch(() => {
        if (!controller.signal.aborted) setTags('error')
      })
    return () => controller.abort()
  }, [requested, path])

  return (
    <details className="osm-tags" onToggle={(e) => e.currentTarget.open && setRequested(true)}>
      <summary>{t('osmTags')}</summary>
      {tags === 'error' ? (
        <p className="footnote">{t('osmTagsError')}</p>
      ) : tags ? (
        <table>
          <tbody>
            {tags.map(([key, value]) => (
              <tr key={key}>
                <th scope="row">{key}</th>
                <td>{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="footnote">{t('loading')}</p>
      )}
    </details>
  )
}
