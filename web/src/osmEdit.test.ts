import { describe, expect, it } from 'vitest'
import { changedTags, changesetComment, EditError, elementXml, noteText, type OsmElement, osmApi } from './osmEdit'

const WAY: OsmElement = {
  type: 'way',
  id: 42,
  version: 3,
  nodes: [1, 2],
  tags: { highway: 'cycleway', name: 'Ottawa River "Pathway" & co' },
}

describe('elementXml', () => {
  it('keeps the whole way, its version and the changeset, escaped', () => {
    expect(elementXml(WAY, 7)).toBe(
      '<osm><way id="42" version="3" changeset="7"><nd ref="1"/><nd ref="2"/>' +
        '<tag k="highway" v="cycleway"/><tag k="name" v="Ottawa River &#34;Pathway&#34; &#38; co"/></way></osm>',
    )
  })

  it('places nodes and lists members', () => {
    expect(elementXml({ type: 'node', id: 5, version: 1, lat: 45.42, lon: -75.69, tags: {} }, 7)).toBe(
      '<osm><node id="5" version="1" changeset="7" lat="45.42" lon="-75.69"></node></osm>',
    )
    const relation: OsmElement = {
      type: 'relation',
      id: 9,
      version: 2,
      members: [{ type: 'way', ref: 42, role: 'outer' }],
      tags: { type: 'multipolygon' },
    }
    expect(elementXml(relation, 7)).toContain('<member type="way" ref="42" role="outer"/>')
  })
})

describe('tags', () => {
  it('changes only what was picked differently, and removes nothing', () => {
    expect(
      changedTags(
        { surface: 'asphalt', lit: 'no' },
        { surface: 'asphalt', lit: 'yes', width: '', winter_service: 'yes' },
      ),
    ).toEqual({
      lit: 'yes',
      winter_service: 'yes',
    })
  })

  it('comments on what a changeset holds', () => {
    expect(changesetComment(['surface'], ['pathways'])).toBe('Set surface on pathways #BikeOttawa')
    expect(changesetComment(['surface', 'width', 'lit'], ['pathways'])).toBe(
      'Set surface, width and lit on pathways #BikeOttawa',
    )
  })

  it('signs notes', () => {
    expect(noteText(' Closed for works \n', 'https://www.openstreetmap.org/way/42')).toBe(
      'Closed for works\n\nSent from BikeOttawa Maps #BikeOttawa\nhttps://www.openstreetmap.org/way/42',
    )
  })
})

/** A fake OSM API: answers in turn, and keeps what was asked. */
function fakeApi(answers: [number, string][], token: string | null = 'secret') {
  const calls: { url: string; method: string; body: string; auth: string | null }[] = []
  let signedOut = false
  const api = osmApi({
    url: 'https://osm.test/api/0.6',
    token: () => token,
    changesetTags: () => ({ created_by: 'BikeOttawa Maps' }),
    onUnauthorized: () => {
      signedOut = true
    },
    fetch: async (input, init) => {
      calls.push({
        url: String(input),
        method: init?.method ?? 'GET',
        body: String(init?.body ?? ''),
        auth: new Headers(init?.headers).get('Authorization'),
      })
      const [status, body] = answers.shift() ?? [500, 'no answer']
      return new Response(body, { status })
    },
  })
  return { api, calls, signedOut: () => signedOut }
}

describe('osmApi', () => {
  it('loads a feature without signing in', async () => {
    const { api, calls } = fakeApi([[200, JSON.stringify({ elements: [{ ...WAY, user: 'someone' }] })]])
    expect(await api.load('way/42')).toEqual(WAY)
    expect(calls[0]).toMatchObject({ url: 'https://osm.test/api/0.6/way/42.json', auth: null })
  })

  it('opens a changeset once, and grows its comment', async () => {
    const { api, calls } = fakeApi([
      [200, '7'],
      [200, '4'],
      [200, ''],
      [200, '5'],
    ])
    const first = await api.save(WAY, { surface: 'asphalt' }, 'pathways')
    expect(first.changeset).toBe(7)
    expect(first.element.version).toBe(4)
    expect(first.element.tags.surface).toBe('asphalt')
    expect(calls[0]).toMatchObject({
      url: 'https://osm.test/api/0.6/changeset/create',
      method: 'PUT',
      auth: 'Bearer secret',
    })
    expect(calls[0].body).toContain('<tag k="comment" v="Set surface on pathways #BikeOttawa"/>')
    expect(calls[0].body).toContain('<tag k="created_by" v="BikeOttawa Maps"/>')
    expect(calls[1]).toMatchObject({ url: 'https://osm.test/api/0.6/way/42', method: 'PUT' })
    expect(calls[1].body).toContain('changeset="7"')

    await api.save(first.element, { width: '3' }, 'pathways')
    expect(calls[2]).toMatchObject({ url: 'https://osm.test/api/0.6/changeset/7', method: 'PUT' })
    expect(calls[2].body).toContain('Set surface and width on pathways')
    expect(calls[3].body).toContain('version="4"')
    expect(calls).toHaveLength(4)
  })

  it('opens another changeset when OSM closed the last one', async () => {
    const { api, calls } = fakeApi([
      [200, '7'],
      [200, '4'],
      [409, 'The changeset 7 was closed at 2026-11-19 20:00:00 UTC'],
      [200, '8'],
      [200, '5'],
    ])
    const { element } = await api.save(WAY, { surface: 'asphalt' }, 'pathways')
    const again = await api.save(element, { surface: 'concrete' }, 'pathways')
    expect(again.changeset).toBe(8)
    expect(calls[3].url).toBe('https://osm.test/api/0.6/changeset/create')
  })

  it('reports an edit made meanwhile by someone else', async () => {
    const { api } = fakeApi([
      [200, '7'],
      [409, 'Version mismatch: Provided 3, server had: 4 of Way 42'],
    ])
    await expect(api.save(WAY, { lit: 'yes' }, 'pathways')).rejects.toMatchObject({ reason: 'conflict' })
  })

  it('signs out when OSM refuses the token', async () => {
    const { api, signedOut } = fakeApi([[401, 'Couldn’t authenticate you']])
    await expect(api.save(WAY, { lit: 'yes' }, 'pathways')).rejects.toMatchObject({ reason: 'auth' })
    expect(signedOut()).toBe(true)
  })

  it('needs a sign-in to edit', async () => {
    const { api, calls } = fakeApi([], null)
    await expect(api.save(WAY, { lit: 'yes' }, 'pathways')).rejects.toBeInstanceOf(EditError)
    expect(calls).toHaveLength(0)
  })

  it('leaves notes, anonymously without a sign-in', async () => {
    const { api, calls } = fakeApi([[200, JSON.stringify({ properties: { id: 99 } })]], null)
    expect(await api.note([-75.69, 45.42], 'Gone')).toBe(99)
    expect(calls[0]).toMatchObject({ url: 'https://osm.test/api/0.6/notes.json', method: 'POST', auth: null })
    expect(new URLSearchParams(calls[0].body).get('lat')).toBe('45.42')
    expect(new URLSearchParams(calls[0].body).get('lon')).toBe('-75.69')
  })

  it('signs notes when signed in', async () => {
    const { api, calls } = fakeApi([[200, JSON.stringify({ properties: { id: 99 } })]])
    await api.note([-75.69, 45.42], 'Gone')
    expect(calls[0].auth).toBe('Bearer secret')
  })
})
