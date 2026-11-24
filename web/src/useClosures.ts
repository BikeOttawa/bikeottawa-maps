import { useEffect, useState } from 'react'
import type { Lang } from './i18n'
import type { Closure } from './roadwork/closures'
import { loadClosures } from './roadwork/sources'

/**
 * The closures right now, in the language shown, from the region's roadwork
 * sources: fetched when the roadwork overlay is first on and kept after that.
 * Null until they answer.
 */
export function useClosures(enabled: boolean, lang: Lang): readonly Closure[] | null {
  const [byLang, setByLang] = useState<Partial<Record<Lang, readonly Closure[]>>>({})
  const closures = byLang[lang]
  useEffect(() => {
    if (!enabled || closures) return
    const controller = new AbortController()
    loadClosures(lang, controller.signal).then((found) => {
      if (!controller.signal.aborted) setByLang((known) => ({ ...known, [lang]: found }))
    })
    return () => controller.abort()
  }, [enabled, lang, closures])
  return closures ?? null
}
