import { describe, expect, it } from 'vitest'
import { EDIT_KINDS, editKind, fieldValues, PATHWAY_FIELDS } from './editFields'
import { isMessageKey } from './i18n'

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

  it('goes by the place’s kind, and leaves out places of no kind', () => {
    expect(editKind('place', { kind: 'toilets' })?.fields.map((f) => f.key)).toEqual([
      'fee',
      'wheelchair',
      'seasonal',
      'changing_table',
    ])
    expect(editKind('place', { kind: 'viewpoint' })).toBeNull()
    expect(editKind('place', { name: 'Found by a search' })).toBeNull()
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
