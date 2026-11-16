// Downloads the City of Ottawa's construction forecast (planned and current
// capital works: roads, sewers and water, cycling, bridges, transit) and
// writes it, trimmed to what the map shows, to <out>/construction.geojson.
// Run by build-overlays.sh, so the file is as fresh as the tiles; not committed.
// Data: Open Government Licence – City of Ottawa.

import { writeFile } from 'node:fs/promises'
import { codedValues, impactsText, kindOf, NOT_HAPPENING, timingOf } from './construction.mjs'

const SERVICE = 'https://maps.ottawa.ca/arcgis/rest/services/ConstructionForecastData/MapServer'
/** Lines (roads, pipes, paths) and points (bridges, buildings, parks). */
const LAYERS = [0, 1]
const PAGE = 1000
const out = process.argv[2] ?? new URL('../web/public/tiles', import.meta.url).pathname

async function json(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`City of Ottawa service: ${res.status}`)
  const data = await res.json()
  if (data.error) throw new Error(`City of Ottawa service: ${data.error.message}`)
  return data
}

const features = []
for (const id of LAYERS) {
  const layer = await json(`${SERVICE}/${id}?f=json`)
  const typeEn = codedValues(layer, 'FEATURE_TYPE')
  const typeFr = codedValues(layer, 'FEATURE_TYPE_FR')
  for (let offset = 0; ; offset += PAGE) {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: 'OBJECTID,FEATURE_TYPE,STATUS,TARGETED_START,TRAFFICIMPACTS,PROJECTWEBPAGE,PROJECTWEBPAGE_FR',
      outSR: '4326',
      // About a metre: enough for a line along a street.
      geometryPrecision: '5',
      maxAllowableOffset: '0.00003',
      orderByFields: 'OBJECTID',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE),
      f: 'geojson',
    })
    const page = await json(`${SERVICE}/${id}/query?${params}`)
    for (const f of page.features) {
      const p = f.properties
      if (!f.geometry || NOT_HAPPENING.includes(p.STATUS)) continue
      const properties = {
        id: `${id}-${p.OBJECTID}`,
        kind: kindOf(p.FEATURE_TYPE),
        timing: timingOf(p.STATUS, p.TARGETED_START),
        type: typeEn.get(p.FEATURE_TYPE) ?? p.FEATURE_TYPE,
        typeFr: typeFr.get(p.FEATURE_TYPE) ?? typeEn.get(p.FEATURE_TYPE) ?? p.FEATURE_TYPE,
        impacts: impactsText(p.TRAFFICIMPACTS),
        url: p.PROJECTWEBPAGE || undefined,
        urlFr: p.PROJECTWEBPAGE_FR || undefined,
      }
      for (const key of Object.keys(properties)) if (properties[key] === undefined) delete properties[key]
      features.push({ type: 'Feature', properties, geometry: f.geometry })
    }
    if (page.features.length < PAGE) break
  }
}

await writeFile(
  `${out}/construction.geojson`,
  `${JSON.stringify({
    type: 'FeatureCollection',
    properties: { source: 'City of Ottawa, Construction Forecast', fetched: new Date().toISOString().slice(0, 10) },
    features,
  })}\n`,
)
const count = (key) =>
  Object.entries(Object.groupBy(features, (f) => f.properties[key]))
    .map(([k, v]) => `${k} ${v.length}`)
    .join(', ')
console.log(`construction: ${features.length} projects; ${count('timing')}; ${count('kind')}`)
