// The region the site is built for: one of the folders here. MAP_REGION picks
// it, from the environment or from a .env file at the top of the repository;
// ottawa unless set. The tile pipeline, the router build and the web build all
// ask here, so they agree. The web tests (Vitest) always read Ottawa's, which
// they are written against.
//
// As a command it prints one value for the shell scripts:
//   node regions/region.mjs id              ottawa
//   node regions/region.mjs dir             regions/ottawa
//   node regions/region.mjs bbox            -76.4,44.95,-75.2,45.65
//   node regions/region.mjs extracts.0.pbf  https://…
//   node regions/region.mjs extracts.length 2

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const HERE = new URL('./', import.meta.url)

function idFromEnvFile() {
  const file = new URL('../.env', HERE)
  if (!existsSync(file)) return undefined
  const line = readFileSync(file, 'utf8')
    .split('\n')
    .findLast((text) => text.startsWith('MAP_REGION='))
  return line?.slice('MAP_REGION='.length).trim()
}

/** The region's id, its folder and its region.json. */
export function loadRegion() {
  const id = (!process.env.VITEST && (process.env.MAP_REGION || idFromEnvFile())) || 'ottawa'
  const dir = fileURLToPath(new URL(`${id}/`, HERE))
  if (!existsSync(`${dir}region.json`)) throw new Error(`No region "${id}": ${dir}region.json is missing`)
  return { id, dir, region: JSON.parse(readFileSync(`${dir}region.json`, 'utf8')) }
}

/** The region's brand files, served at the top of the site: file name → contents. */
export function brandFiles(dir) {
  return Object.fromEntries(readdirSync(`${dir}brand`).map((name) => [name, readFileSync(`${dir}brand/${name}`)]))
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { id, region } = loadRegion()
  const path = process.argv[2] ?? 'dir'
  const value = { id, dir: `regions/${id}` }[path] ?? path.split('.').reduce((at, key) => at?.[key], region)
  if (value === undefined) {
    console.error(`regions/${id}/region.json has no ${path}`)
    process.exit(1)
  }
  console.log(Array.isArray(value) ? value.join(',') : String(value))
}
