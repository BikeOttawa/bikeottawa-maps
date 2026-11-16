import { useEffect, useState } from 'react'
import { CLOSURES_URL, type Closure, parseClosures } from './construction'
import type { Lang } from './i18n'

/**
 * The closures on the City's traffic map right now, in the language shown:
 * fetched when the construction layer first shows them, kept after that.
 * Null until they arrive, or if the City's map does not answer.
 */
export function useClosures(enabled: boolean, lang: Lang): readonly Closure[] | null {
  const [byLang, setByLang] = useState<Partial<Record<Lang, readonly Closure[]>>>({})
  const closures = byLang[lang]
  useEffect(() => {
    if (!enabled || closures) return
    const controller = new AbortController()
    fetch(`${CLOSURES_URL}?accept-language=${lang}`, { signal: controller.signal })
      .then((res) => res.json())
      .then((json) => setByLang((known) => ({ ...known, [lang]: parseClosures(json) })))
      .catch(() => {})
    return () => controller.abort()
  }, [enabled, lang, closures])
  return closures ?? null
}
