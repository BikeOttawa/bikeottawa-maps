import type { LineString, MultiLineString } from 'geojson'
import { type Lang, translator } from '../../i18n'
import { type Closure, getJson, middleOf, type RoadworkCredit, type RoadworkSource } from '../closures'

export const credit: RoadworkCredit = { name: 'Québec 511', url: 'https://www.quebec511.info' }

/**
 * Québec 511: roadwork on the roads the province runs (autoroutes, numbered
 * routes, the Macdonald-Cartier bridge), within a box [west, south, east,
 * north]. The province's whole list is about 700 KB, so only the box is asked for.
 */
export function url([west, south, east, north]: readonly number[]): string {
  return (
    'https://ws.mapserver.transports.gouv.qc.ca/swtq?service=wfs&version=2.0.0&request=getfeature' +
    '&typename=ms:chantiers_mtmdet&srsname=EPSG:4326&outputformat=geojson' +
    `&bbox=${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`
  )
}

interface Answer {
  features?: {
    geometry: LineString | MultiLineString | null
    properties: {
      identifiant?: string | number
      descriptionFrancais?: string
      descriptionAnglais?: string
      identificationDesTravaux?: string
      detoursEtItinerairesFacultatifs?: string
      debut?: string
      fin?: string
      urlFrancais?: string
    }
  }[]
}

/** "2026/08/24 07:00:00" → "2026-08-24T07:00". */
const time = (text?: string) => {
  const m = /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2})/.exec(text ?? '')
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}` : undefined
}

/**
 * Quebec's roadwork as closures. Its descriptions come in French and English,
 * a line each for the work, where, which way, what is closed and the detour:
 * the work heads the card, the rest is its text.
 */
export function parse(json: Answer, lang: Lang): Closure[] {
  const t = translator(lang)
  const closures: Closure[] = []
  for (const work of json.features ?? []) {
    const { geometry: line, properties: p } = work
    if (!line || (line.type !== 'LineString' && line.type !== 'MultiLineString')) continue
    const text = (lang === 'fr' ? p.descriptionFrancais : p.descriptionAnglais) || p.descriptionFrancais || ''
    const lines = text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
    const detour = (p.detoursEtItinerairesFacultatifs ?? '').replace(/\s+/g, ' ').trim()
    closures.push({
      id: String(p.identifiant),
      at: middleOf(line),
      line,
      headline: lines[0] ?? p.identificationDesTravaux ?? '',
      message: lines.slice(1).join('\n'),
      // The detour is in the text already; only French gives it apart.
      detour: lang === 'fr' && detour ? detour : undefined,
      start: time(p.debut),
      end: time(p.fin),
      by: t('roadwork.by.quebec511'),
      url: /^https?:\/\//i.test(p.urlFrancais ?? '') ? p.urlFrancais : undefined,
    })
  }
  return closures
}

const quebec511: RoadworkSource = async ({ bbox, lang, signal }) =>
  parse(await getJson<Answer>(url(bbox), signal), lang)

export default quebec511
