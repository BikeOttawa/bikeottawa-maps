import region from '@region/region.json'
import type { CityData, CityDataKind, Credit, Region } from '../../regions/region.mjs'
import { type Lang, translator } from './i18n'

/**
 * The region the site is for: its area, names, links and what it shows, from
 * regions/<id>/region.json. `@region` is that folder, picked when the site is
 * built (regions/region.mjs); the tests always read Ottawa's.
 */
export const REGION: Region = region as typeof region & Pick<Region, 'bbox' | 'center' | 'routingBbox'>

/** A piece of the city's own data, a layer or an overlay, where the region names it in `cityData`. */
export function cityData(kind: CityDataKind): CityData | undefined {
  return REGION.cityData?.[kind]
}

/** Whether the site shows that piece. */
export function hasCityData(kind: CityDataKind): boolean {
  return Boolean(cityData(kind))
}

/** A line of the map's credits: "Collisions: City of Ottawa", each name a link. Empty with no one to credit. */
export function creditLine(label: string, credits: readonly Credit[] = []): string {
  const links = credits.map(({ name, url }) => `<a href="${url}" target="_blank" rel="noopener">${name}</a>`)
  return links.length ? `${label}: ${links.join(', ')}` : ''
}

/**
 * A legend's line about its data, in the region's words: "City of Ottawa open
 * data, 2017 to 2024." with the years it covers, else "City of Ottawa
 * construction forecast."; then the region's note. Empty if the region gives none.
 */
export function sourceLine(kind: CityDataKind, lang: Lang, years?: { first: number; last: number }): string {
  const data = cityData(kind)
  if (!data?.source) return ''
  const source = years
    ? translator(lang)('sourceYears')
        .replace('{source}', data.source[lang])
        .replace('{first}', String(years.first))
        .replace('{last}', String(years.last))
    : `${data.source[lang]}.`
  return [source, data.note?.[lang]].filter(Boolean).join(' ')
}
