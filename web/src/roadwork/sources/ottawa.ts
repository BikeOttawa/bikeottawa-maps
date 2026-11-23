import { isMessageKey, type Lang, translator } from '../../i18n'
import { type Closure, getJson, type RoadworkCredit, type RoadworkSource } from '../closures'

export const credit: RoadworkCredit = { name: 'City of Ottawa', url: 'https://traffic.ottawa.ca/map/' }

/** The City of Ottawa's live traffic map, in English or French. It has no box to ask for: the whole city comes. */
const EVENTS_URL = 'https://traffic.ottawa.ca/map/service/events'

interface Answer {
  events?: {
    id: number
    headline?: string
    message?: string
    mainStreet?: string
    lanes?: string
    /** Who reported it: CITY, MTO, NCC, GATINEAU, LRT… */
    generation_source?: string
    schedule?: { startDateTime?: string; endDateTime?: string }[]
    geodata?: { type?: string; coordinates?: string | number[] }
  }[]
}

/** The closures in the traffic map's answer: those with a place on the map. */
export function parse(json: Answer, lang: Lang): Closure[] {
  const t = translator(lang)
  const closures: Closure[] = []
  for (const event of json.events ?? []) {
    const raw = event.geodata?.coordinates
    let at: unknown
    try {
      at = typeof raw === 'string' ? JSON.parse(raw) : raw
    } catch {
      continue
    }
    if (!Array.isArray(at) || at.length < 2 || !at.every(Number.isFinite)) continue
    const starts = (event.schedule ?? []).map((s) => s.startDateTime).filter((s): s is string => Boolean(s))
    const ends = (event.schedule ?? []).map((s) => s.endDateTime).filter((s): s is string => Boolean(s))
    const by = `roadwork.by.ottawa.${event.generation_source}`
    closures.push({
      id: String(event.id),
      at: [at[0], at[1]],
      headline: (event.headline ?? '').trim(),
      message: (event.message ?? '').trim(),
      street: event.mainStreet?.trim() || undefined,
      lanes: event.lanes?.trim() || undefined,
      start: starts.sort()[0],
      end: ends.sort().at(-1),
      by: isMessageKey(by) ? t(by) : event.generation_source,
    })
  }
  return closures
}

const ottawa: RoadworkSource = async ({ lang, signal }) =>
  parse(await getJson<Answer>(`${EVENTS_URL}?accept-language=${lang}`, signal), lang)

export default ottawa
