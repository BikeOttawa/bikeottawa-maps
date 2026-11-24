// Downloads Ottawa's wards and Gatineau's districts with their councillors and
// writes them to the region's data/wards.geojson: one polygon per ward and one
// point inside it for the label. The file is committed; run this again
// (npm run wards) after an election or a by-election.
// Data: City of Ottawa (Open Government Licence – Ottawa), Ville de Gatineau (CC BY 4.0).

import { writeFile } from 'node:fs/promises'
import { districtName, labelPoint, lighten, ottawaCouncillors } from './wards.mjs'

const OTTAWA_WARDS = 'https://maps.ottawa.ca/arcgis/rest/services/Planning/MapServer/277'
const OTTAWA_COUNCIL =
  'https://services.arcgis.com/G6F8XLCl5KtAlZ2G/arcgis/rest/services/_Elected_Officials_2022_2026/FeatureServer/0'
const GATINEAU_DISTRICTS = 'https://www.gatineau.ca/upload/donneesouvertes/DISTRICT_ELECTORAUX.json'
const OUT = new URL('../data/wards.geojson', import.meta.url)

async function json(url, what) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${what}: ${res.status}`)
  // Gatineau's files start with a byte-order mark.
  const data = JSON.parse((await res.text()).replace(/^﻿/, ''))
  if (data.error) throw new Error(`${what}: ${data.error.message}`)
  return data
}

const query = (service, params) => `${service}/query?${new URLSearchParams({ where: '1=1', ...params })}`

const wards = await json(
  query(OTTAWA_WARDS, { outFields: 'WARD_NUM,WARD_NAME_EN,WARD_NAME_FR', outSR: '4326', f: 'geojson' }),
  'Ottawa wards',
)
const council = await json(
  query(OTTAWA_COUNCIL, { outFields: 'ObjectId,Ward_number,Ward_name,Primary_Role,First_name,Last_name', f: 'json' }),
  'Ottawa councillors',
)
const districts = await json(GATINEAU_DISTRICTS, 'Gatineau districts')

const councillors = ottawaCouncillors(council.features.map((f) => f.attributes))
const areas = [
  ...wards.features.map((f) => {
    const num = Number(f.properties.WARD_NUM)
    return {
      geometry: f.geometry,
      properties: {
        city: 'ottawa',
        num,
        name_en: f.properties.WARD_NAME_EN,
        name_fr: f.properties.WARD_NAME_FR,
        councillor: councillors.get(num),
      },
    }
  }),
  ...districts.features.map((f) => {
    const name = districtName(f.properties.DISTRICT)
    return {
      geometry: f.geometry,
      properties: {
        city: 'gatineau',
        num: Number(f.properties.NUM),
        name_en: name,
        name_fr: name,
        councillor: f.properties.CONS,
      },
    }
  }),
]

// A ward without a councillor means the sources changed shape; better to stop than to ship gaps.
const missing = areas.filter((a) => !a.properties.councillor || !a.properties.name_en)
if (missing.length)
  throw new Error(`No councillor or name for ${missing.map((a) => `${a.properties.city} ${a.properties.num}`)}`)
const count = (city) => areas.filter((a) => a.properties.city === city).length
console.log(`wards: Ottawa ${count('ottawa')}, Gatineau ${count('gatineau')}`)

const features = areas
  .sort((a, b) => a.properties.city.localeCompare(b.properties.city) || a.properties.num - b.properties.num)
  .flatMap(({ geometry, properties }) => {
    const light = lighten(geometry)
    return [
      { type: 'Feature', properties, geometry: light },
      { type: 'Feature', properties, geometry: { type: 'Point', coordinates: labelPoint(light) } },
    ]
  })

const collection = {
  type: 'FeatureCollection',
  properties: {
    source:
      'City of Ottawa, Wards 2026-2030 and Elected Officials (Open Government Licence – Ottawa); Ville de Gatineau, Districts électoraux (CC BY 4.0)',
    fetched: new Date().toISOString().slice(0, 10),
  },
  features,
}
await writeFile(OUT, `${JSON.stringify(collection)}\n`)
for (const { properties: p } of features.filter((f) => f.geometry.type === 'Point')) {
  console.log(`  ${p.city} ${String(p.num).padStart(2)} ${p.name_en}: ${p.councillor}`)
}
