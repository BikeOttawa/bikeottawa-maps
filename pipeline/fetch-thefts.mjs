// Downloads the Ottawa Police Service's bike thefts and writes them, trimmed to
// what the map shows, to web/public/data/thefts.geojson. The file is committed;
// run this again (npm run thefts) when the police publish a new year.
// Each theft is placed at the nearest intersection, not where it happened.
// Data: Open Government Licence – Ottawa Police Service.

import { writeFile } from 'node:fs/promises'
import { bikeType, makeNamer, NOT_A_BIKE, ottawaDay, THEFT_STATUSES, takenFrom } from './thefts.mjs'

const SERVICE =
  'https://services7.arcgis.com/2vhcNzw0NfUwAD3d/arcgis/rest/services/Bike_Theft_Open_Data/FeatureServer/0'
const OUT = new URL('../web/public/data/thefts.geojson', import.meta.url)
const PAGE = 2000

async function page(offset) {
  const params = new URLSearchParams({
    where: `STATUS IN (${THEFT_STATUSES.map((s) => `'${s}'`).join(',')})`,
    outFields:
      'ID,OCC_DATE,OCC_HOUR,TOD,OFF_CATEG,STATUS,BIKE_TYPE,BIKE_STYLE,BIKE_MAKE,BIKE_VALUE,INTERSECTION,NB_NAME_EN',
    returnGeometry: 'true',
    outSR: '4326',
    orderByFields: 'OBJECTID',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE),
    f: 'json',
  })
  const res = await fetch(`${SERVICE}/query?${params}`)
  if (!res.ok) throw new Error(`Ottawa Police service: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`Ottawa Police service: ${data.error.message}`)
  return data.features
}

const rows = []
for (let offset = 0; ; offset += PAGE) {
  const batch = await page(offset)
  rows.push(...batch)
  if (batch.length < PAGE) break
}

const makeName = makeNamer(rows.map((r) => r.attributes.BIKE_MAKE))
const round = (x) => Math.round(x * 1e5) / 1e5
const tidy = (text) =>
  String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim() || undefined

const features = rows
  .filter(({ attributes: a, geometry: g }) => Number.isFinite(g?.x) && Number.isFinite(g?.y) && a.OCC_DATE)
  .filter(({ attributes: a }) => !NOT_A_BIKE.includes(a.BIKE_STYLE))
  .map(({ attributes: a, geometry: g }) => {
    const value = Number(a.BIKE_VALUE)
    const properties = {
      id: a.ID,
      // When it was taken, as reported: often a guess, such as overnight.
      date: ottawaDay(a.OCC_DATE),
      hour: Number.isFinite(a.OCC_HOUR) ? Math.floor(a.OCC_HOUR / 100) : undefined,
      time: a.TOD ? String(a.TOD).toLowerCase() : undefined,
      where: takenFrom(a.OFF_CATEG),
      type: bikeType(a.BIKE_TYPE, a.BIKE_STYLE),
      make: makeName(a.BIKE_MAKE),
      value: value > 0 ? value : undefined,
      recovered: a.STATUS === 'Recovered' || undefined,
      place: tidy(a.INTERSECTION),
      area: tidy(a.NB_NAME_EN),
    }
    for (const key of Object.keys(properties)) if (properties[key] === undefined) delete properties[key]
    return { type: 'Feature', properties, geometry: { type: 'Point', coordinates: [round(g.x), round(g.y)] } }
  })
  .sort((a, b) => a.properties.date.localeCompare(b.properties.date))

// Years with thefts all through them; a few older ones were reported late.
const byYear = Map.groupBy(features, (f) => Number(f.properties.date.slice(0, 4)))
const years = [...byYear.keys()].filter((y) => byYear.get(y).length >= 100).sort()
const kept = features.filter((f) => years.includes(Number(f.properties.date.slice(0, 4))))

const collection = {
  type: 'FeatureCollection',
  properties: {
    source: 'Ottawa Police Service, Bike Theft (Open Government Licence – Ottawa Police Service)',
    years,
    fetched: new Date().toISOString().slice(0, 10),
  },
  features: kept,
}
await writeFile(OUT, `${JSON.stringify(collection)}\n`)
const recovered = kept.filter((f) => f.properties.recovered).length
console.log(`thefts: ${kept.length} (recovered ${recovered}), years ${years.join(', ')}`)
