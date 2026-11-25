/**
 * Editing OpenStreetMap from the cards: a feature's tags and new places, as
 * the person signed in, and notes for what they cannot fix themselves. The
 * sign-in is apart (osmAuth.ts), so this runs without a browser.
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

/** The tags picked or typed that differ from the feature's, without spaces around. A tag is never removed. */
export function changedTags(tags: Record<string, string>, picks: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(picks)
      .map(([key, value]) => [key, value.trim()])
      .filter(([key, value]) => value !== '' && value !== tags[key]),
  )
}

/** "a", "a and b", "a, b and c". */
function list(items: string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`
}

/** What a changeset holds: the places added, and the tags set on which kinds of feature. */
export interface ChangesetContents {
  added: string[]
  keys: string[]
  things: string[]
}

/** A changeset's comment, from all it holds: "Add benches; set surface and width on pathways #BikeOttawa". */
export function changesetComment({ added, keys, things }: ChangesetContents): string {
  const parts = [
    ...(added.length ? [`add ${list(added)}`] : []),
    ...(keys.length ? [`set ${list(keys)} on ${list(things)}`] : []),
  ].join('; ')
  return `${parts.charAt(0).toUpperCase()}${parts.slice(1)} ${REGION.osm.hashtag}`
}

/** A note's text: the person's words, then where it comes from and what it is about, for mappers. */
export function noteText(text: string, feature: string | null): string {
  const from = `Sent from ${REGION.osm.createdBy} ${REGION.osm.hashtag}`
  return [text.trim(), '', from, feature].filter((line) => line !== null).join('\n')
}

/** A note asking mappers to add a place: its tags as they would go on the map, then the person's words. */
export function placeNoteText(tags: Record<string, string>, text: string): string {
  const lines = ['Missing from the map, to add here:', ...Object.entries(tags).map(([k, v]) => `${k}=${v}`)]
  return noteText([...lines, ...(text.trim() ? ['', text.trim()] : [])].join('\n'), null)
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

/** A new node, at OSM's precision (about a centimetre). */
export function newNodeXml(at: [number, number], tags: Record<string, string>, changeset: number): string {
  const [lon, lat] = at.map((n) => Number(n.toFixed(7)))
  return `<osm><node changeset="${changeset}" lat="${lat}" lon="${lon}">${tagsXml(tags)}</node></osm>`
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
  let open: ({ id: number } & ChangesetContents) | null = null

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

  async function changeset(edit: ChangesetContents): Promise<number> {
    if (open) {
      const join = (a: string[], b: string[]) => [...new Set([...a, ...b])]
      const contents = {
        added: join(open.added, edit.added),
        keys: join(open.keys, edit.keys),
        things: join(open.things, edit.things),
      }
      if (changesetComment(contents) !== changesetComment(open)) {
        open = { id: open.id, ...contents }
        const tags = { ...options.changesetTags(), comment: changesetComment(contents) }
        // Only the comment: the edit goes in all the same.
        await request(`/changeset/${open.id}`, xml('PUT', changesetXml(tags))).catch(() => undefined)
      }
      return open.id
    }
    const tags = { ...options.changesetTags(), comment: changesetComment(edit) }
    const res = await request('/changeset/create', xml('PUT', changesetXml(tags)))
    if (!res.ok) throw new EditError('failed', await res.text())
    open = { id: Number(await res.text()), ...edit }
    return open.id
  }

  /** Sends an edit in the open changeset, or once more in a new one when OSM closed it meanwhile. Gives OSM's answer. */
  async function send(
    path: string,
    body: (changeset: number) => string,
    edit: ChangesetContents,
  ): Promise<{ answer: string; changeset: number }> {
    for (let tries = 0; ; tries++) {
      const id = await changeset(edit)
      const res = await request(path, xml('PUT', body(id)))
      const text = await res.text()
      if (res.ok) return { answer: text, changeset: id }
      if (res.status === 409 && /closed/i.test(text) && tries === 0) {
        open = null
        continue
      }
      if (res.status === 409) throw new EditError('conflict', text)
      if (res.status === 404 || res.status === 410) throw new EditError('gone', text)
      throw new EditError('failed', text)
    }
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
      const { answer, changeset } = await send(`/${element.type}/${element.id}`, (id) => elementXml(saved, id), {
        added: [],
        keys: Object.keys(changes),
        things: [thing],
      })
      return { element: { ...saved, version: Number(answer) }, changeset }
    },

    /** Adds a place: a node with these tags. `thing` is what it is, for the changeset comment ("benches"). Gives its id. */
    async create(
      at: [number, number],
      tags: Record<string, string>,
      thing: string,
    ): Promise<{ id: number; changeset: number }> {
      const { answer, changeset } = await send('/node/create', (id) => newNodeXml(at, tags, id), {
        added: [thing],
        keys: [],
        things: [],
      })
      return { id: Number(answer), changeset }
    },

    /** Leaves a note on the map, as the person signed in or else anonymously. Gives its number. */
    async note(at: [number, number], text: string): Promise<number> {
      const body = new URLSearchParams({ lat: String(at[1]), lon: String(at[0]), text })
      const res = await request('/notes.json', { method: 'POST', body }, options.token() !== null)
      if (!res.ok) throw new EditError('failed', await res.text())
      const data: { properties: { id: number } } = await res.json()
      return data.properties.id
    },

    /** When a note was closed, as an ISO date; null while it is open. */
    async noteClosed(id: number): Promise<string | null> {
      const res = await request(`/notes/${id}.json`, {}, false)
      if (!res.ok) throw new EditError(res.status === 404 || res.status === 410 ? 'gone' : 'failed')
      const data: { properties: { status: string; closed_at?: string } } = await res.json()
      const { status, closed_at: closed } = data.properties
      // OSM writes "2026-11-25 14:00:00 UTC".
      return status === 'closed' && closed
        ? new Date(closed.replace(' UTC', 'Z').replace(' ', 'T')).toISOString()
        : null
    },
  }
}

export type OsmApi = ReturnType<typeof osmApi>
