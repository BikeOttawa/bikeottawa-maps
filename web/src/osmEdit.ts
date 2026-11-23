/**
 * Editing OpenStreetMap from the cards: a feature's tags, as the person signed
 * in, and notes for what they cannot fix themselves. The sign-in is apart
 * (osmAuth.ts), so this runs without a browser.
 */

import { REGION } from './region'

export interface OsmElement {
  type: 'node' | 'way' | 'relation'
  id: number
  version: number
  lat?: number
  lon?: number
  nodes?: number[]
  members?: { type: string; ref: number; role: string }[]
  tags: Record<string, string>
}

/** The tags picked that differ from the feature's. A tag is never removed. */
export function changedTags(tags: Record<string, string>, picks: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(picks).filter(([key, value]) => value !== '' && value !== tags[key]))
}

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** A changeset's comment, from all it holds: "Set surface and width on pathways #BikeOttawa". */
export function changesetComment(keys: string[], things: string[]): string {
  return `Set ${list(keys)} on ${list(things)} ${REGION.osm.hashtag}`
}

/** A note's text: the person's words, then where it comes from and what it is about, for mappers. */
export function noteText(text: string, feature: string | null): string {
  const from = `Sent from ${REGION.osm.createdBy} ${REGION.osm.hashtag}`
  return [text.trim(), '', from, feature].filter((line) => line !== null).join('\n')
}

const escapeXml = (text: string): string => text.replace(/[&<>"'\n\r\t]/g, (c) => `&#${c.charCodeAt(0)};`)

const tagsXml = (tags: Record<string, string>): string =>
  Object.entries(tags)
    .map(([k, v]) => `<tag k="${escapeXml(k)}" v="${escapeXml(v)}"/>`)
    .join('')

export function changesetXml(tags: Record<string, string>): string {
  return `<osm><changeset>${tagsXml(tags)}</changeset></osm>`
}

/** An element as the API takes it back: all of it, with its version and the changeset it goes in. */
export function elementXml(element: OsmElement, changeset: number): string {
  const { type, id, version } = element
  const position = type === 'node' ? ` lat="${element.lat}" lon="${element.lon}"` : ''
  const nodes = (element.nodes ?? []).map((ref) => `<nd ref="${ref}"/>`).join('')
  const members = (element.members ?? [])
    .map((m) => `<member type="${m.type}" ref="${m.ref}" role="${escapeXml(m.role)}"/>`)
    .join('')
  return `<osm><${type} id="${id}" version="${version}" changeset="${changeset}"${position}>${nodes}${members}${tagsXml(element.tags)}</${type}></osm>`
}

/** Why an edit did not go through. */
export type EditFailure =
  /** Someone else changed the feature since it was loaded. */
  | 'conflict'
  /** OSM no longer takes the sign-in. */
  | 'auth'
  /** Not on this OSM server, or deleted. */
  | 'gone'
  | 'failed'

export class EditError extends Error {
  constructor(
    readonly reason: EditFailure,
    message: string = reason,
  ) {
    super(message)
  }
}

export interface OsmApiOptions {
  /** The API's root, ending in /api/0.6. */
  url: string
  /** The signed-in person's token; without one, notes are sent anonymously and nothing else can be. */
  token: () => string | null
  /** Tags every changeset carries besides its comment: what made it. */
  changesetTags: () => Record<string, string>
  /** Told when OSM refuses the token, to sign out. */
  onUnauthorized?: () => void
  fetch?: typeof fetch
}

/**
 * Edits go in one changeset while it stays open, as other editors do; its
 * comment grows to cover what each edit adds. OSM closes it after an hour
 * without edits.
 */
export function osmApi(options: OsmApiOptions) {
  const get = options.fetch ?? ((input, init) => fetch(input, init))
  let open: { id: number; keys: string[]; things: string[] } | null = null

  async function request(path: string, init: RequestInit = {}, signed = true): Promise<Response> {
    const token = signed ? options.token() : null
    if (signed && !token) throw new EditError('auth')
    const headers = new Headers(init.headers)
    if (token) headers.set('Authorization', `Bearer ${token}`)
    const res = await get(`${options.url}${path}`, { ...init, headers })
    if (res.status === 401 && token) {
      options.onUnauthorized?.()
      throw new EditError('auth')
    }
    return res
  }

  const xml = (method: string, body: string): RequestInit => ({
    method,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
    body,
  })

  async function changeset(keys: string[], thing: string): Promise<number> {
    if (open) {
      const more = [...new Set([...open.keys, ...keys])]
      const things = open.things.includes(thing) ? open.things : [...open.things, thing]
      if (more.length > open.keys.length || things.length > open.things.length) {
        open = { ...open, keys: more, things }
        const tags = { ...options.changesetTags(), comment: changesetComment(more, things) }
        // Only the comment: the edit goes in all the same.
        await request(`/changeset/${open.id}`, xml('PUT', changesetXml(tags))).catch(() => undefined)
      }
      return open.id
    }
    const tags = { ...options.changesetTags(), comment: changesetComment(keys, [thing]) }
    const res = await request('/changeset/create', xml('PUT', changesetXml(tags)))
    if (!res.ok) throw new EditError('failed', await res.text())
    open = { id: Number(await res.text()), keys, things: [thing] }
    return open.id
  }

  return {
    /** A feature as it is in OSM now, by its path ("way/123"). */
    async load(path: string): Promise<OsmElement> {
      const res = await request(`/${path}.json`, {}, false)
      if (res.status === 404 || res.status === 410) throw new EditError('gone')
      if (!res.ok) throw new EditError('failed', await res.text())
      const data: { elements: (OsmElement & Record<string, unknown>)[] } = await res.json()
      const { type, id, version, lat, lon, nodes, members, tags } = data.elements[0]
      return { type, id, version, lat, lon, nodes, members, tags: tags ?? {} }
    },

    /**
     * Sets tags on a feature as loaded. `thing` is what it is, for the
     * changeset comment ("pathways"). Gives the feature back as saved, and its changeset.
     */
    async save(
      element: OsmElement,
      changes: Record<string, string>,
      thing: string,
    ): Promise<{ element: OsmElement; changeset: number }> {
      const saved = { ...element, tags: { ...element.tags, ...changes } }
      for (let tries = 0; ; tries++) {
        const id = await changeset(Object.keys(changes), thing)
        const res = await request(`/${element.type}/${element.id}`, xml('PUT', elementXml(saved, id)))
        if (res.ok) return { element: { ...saved, version: Number(await res.text()) }, changeset: id }
        const text = await res.text()
        // OSM closed the changeset meanwhile: once more in a new one.
        if (res.status === 409 && /closed/i.test(text) && tries === 0) {
          open = null
          continue
        }
        if (res.status === 409) throw new EditError('conflict', text)
        if (res.status === 404 || res.status === 410) throw new EditError('gone', text)
        throw new EditError('failed', text)
      }
    },

    /** Leaves a note on the map, as the person signed in or else anonymously. Gives its number. */
    async note(at: [number, number], text: string): Promise<number> {
      const body = new URLSearchParams({ lat: String(at[1]), lon: String(at[0]), text })
      const res = await request('/notes.json', { method: 'POST', body }, options.token() !== null)
      if (!res.ok) throw new EditError('failed', await res.text())
      const data: { properties: { id: number } } = await res.json()
      return data.properties.id
    },
  }
}

export type OsmApi = ReturnType<typeof osmApi>
