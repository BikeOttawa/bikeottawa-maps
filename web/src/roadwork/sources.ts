import { isMessageKey, type Lang, translator } from '../i18n'
import { REGION } from '../region'
import type { Closure, RoadworkCredit, RoadworkSource } from './closures'

/** Every source there is, by its file's name. */
const FILES = import.meta.glob<{ default: RoadworkSource; credit: RoadworkCredit }>(
  ['./sources/*.ts', '!./sources/*.test.ts'],
  { eager: true },
)
const file = (name: string) => FILES[`./sources/${name}.ts`]

/** The sources the region reads its roadwork from; none, and it has no Roadwork overlay. */
export const ROADWORK_SOURCES: readonly string[] = REGION.roadwork ?? []

/**
 * The closures right now from each of the region's sources, each id with its
 * source's name before it. A source failing leaves the others'.
 */
export async function loadClosures(lang: Lang, signal: AbortSignal): Promise<Closure[]> {
  const answers = await Promise.allSettled(
    ROADWORK_SOURCES.map(async (name) => {
      const closures = await file(name).default({ bbox: REGION.bbox, lang, signal })
      return closures.map((closure) => ({ ...closure, id: `${name}-${closure.id}` }))
    }),
  )
  return answers.flatMap((answer) => (answer.status === 'fulfilled' ? answer.value : []))
}

/** What the overlay reads, for its hint: "the City of Ottawa’s traffic map and Québec 511 on Quebec’s highways". */
export function roadworkSourceNames(lang: Lang): string {
  const t = translator(lang)
  const names = ROADWORK_SOURCES.map((name) => {
    const key = `roadwork.source.${name}`
    return isMessageKey(key) ? t(key) : name
  })
  return new Intl.ListFormat(lang === 'fr' ? 'fr-CA' : 'en-CA', { type: 'conjunction' }).format(names)
}

/** Whose data the overlay shows, for the map's credits. */
export const ROADWORK_ATTRIBUTION = `Roadwork: ${ROADWORK_SOURCES.map((name) => file(name).credit)
  .map(({ name, url }) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`)
  .join(', ')}`
