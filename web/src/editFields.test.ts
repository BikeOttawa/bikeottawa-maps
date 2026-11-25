import { describe, expect, it } from 'vitest'
import { EDIT_KINDS, editKind, fieldValues, kindTag, newPlaceTags, PATHWAY_FIELDS } from './editFields'
import { isMessageKey } from './i18n'
import { PLACE_KINDS } from './places'

describe('new places', () => {
  it('can be of every kind the legend has, by a tag the tiles read', () => {
    for (const kind of PLACE_KINDS) expect(Object.keys(kindTag(kind, false)), kind).toHaveLength(1)
    expect(kindTag('splash', false)).toEqual({ leisure: 'splash_pad' })
  })

  it('take the tag a name allows once they have one', () => {
    expect(kindTag('beach', false)).toEqual({ leisure: 'swimming_area' })
    expect(kindTag('beach', true)).toEqual({ natural: 'beach' })
    // Not one that needs more than a name.
    expect(kindTag('artwork', true)).toEqual({ tourism: 'artwork' })
  })

  it('get their kind’s tag, their name and the details picked', () => {
    expect(newPlaceTags('picnic', '', { covered: 'yes', material: '' })).toEqual({
      leisure: 'picnic_table',
      covered: 'yes',
    })
    expect(newPlaceTags('pub', '  The Royal Oak ', { note: ' Closed Sundays ' })).toEqual({
      amenity: 'pub',
      name: 'The Royal Oak',
      note: 'Closed Sundays',
    })
  })
})

describe('editKind', () => {
  it('goes by the way’s kind', () => {
    expect(editKind('way', { kind: 'path', pathway: true })?.thing).toBe('pathways')
    expect(editKind('way', { kind: 'path' })?.thing).toBe('paths')
    expect(editKind('way', { kind: 'street' })?.fields.map((f) => f.key)).toEqual([
      'maxspeed',
      'lanes',
      'surface',
      'smoothness',
      'lit',
    ])
  })

  it('goes by the place’s kind, with a note on every place, and leaves out places of no kind', () => {
    expect(editKind('place', { kind: 'toilets' })?.fields.map((f) => f.key)).toEqual([
      'fee',
      'wheelchair',
      'seasonal',
      'changing_table',
      'note',
    ])
    expect(editKind('place', { kind: 'viewpoint' })).toMatchObject({ thing: 'viewpoint', fields: [{ key: 'note' }] })
    expect(editKind('place', { name: 'Found by a search' })).toBeNull()
    expect(editKind('place', { kind: 'barrier' })).toBeNull()
  })
})

describe('fields', () => {
  it('name every value, in both languages', () => {
    for (const kind of EDIT_KINDS) {
      for (const field of kind.fields) {
        for (const value of field.names === undefined ? [] : field.values) {
          expect(isMessageKey(`${field.names}${value}`), `${field.key}=${value}`).toBe(true)
        }
      }
    }
  })

  it('offer a feature’s own value first when the list lacks it', () => {
    const surface = PATHWAY_FIELDS[0]
    expect(fieldValues(surface, 'asphalt')[0]).toBe('asphalt')
    expect(fieldValues(surface, 'dirt')[0]).toBe('dirt')
    expect(fieldValues(surface, undefined)).toEqual(surface.values)
  })
})
