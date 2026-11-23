import { useEffect, useState } from 'react'
import { CLOSURES_URL, type Closure, parseClosures, parseQuebecRoadwork, quebecRoadworkUrl } from './construction'
import type { Lang } from './i18n'
import { REGION } from './region'

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

/**
 * The closures right now, in the language shown: the City of Ottawa's traffic
 * map and Quebec's roadwork on its roads in the map's area, fetched when the
 * roadwork overlay is first on and kept after that. Either source failing
 * leaves the other's. Null until they answer.
 */
export function useClosures(enabled: boolean, lang: Lang): readonly Closure[] | null {
  const [byLang, setByLang] = useState<Partial<Record<Lang, readonly Closure[]>>>({})
  const closures = byLang[lang]
  useEffect(() => {
    if (!enabled || closures) return
    const controller = new AbortController()
    Promise.allSettled([
      fetchJson(`${CLOSURES_URL}?accept-language=${lang}`, controller.signal).then((json) =>
        parseClosures(json as Parameters<typeof parseClosures>[0]),
      ),
      fetchJson(quebecRoadworkUrl(REGION.bbox), controller.signal).then((json) =>
        parseQuebecRoadwork(json as Parameters<typeof parseQuebecRoadwork>[0], lang),
      ),
    ]).then((results) => {
      if (controller.signal.aborted) return
      const found = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
      setByLang((known) => ({ ...known, [lang]: found }))
    })
    return () => controller.abort()
  }, [enabled, lang, closures])
  return closures ?? null
}
