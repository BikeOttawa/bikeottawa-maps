import { describe, expect, it } from 'vitest'
import { streetAlong } from './streetAlong'

// A north–south project crossing an east–west street, at about 45.4°N.
const line = (coordinates: [number, number][]) => ({ type: 'LineString' as const, coordinates })
const project = line([
  [-75.65, 45.39],
  [-75.65, 45.41],
])
const crossing = {
  name: 'Hemlock Road',
  geometry: line([
    [-75.66, 45.4],
    [-75.64, 45.4],
  ]),
}
const along = {
  name: 'St. Laurent Boulevard',
  geometry: line([
    [-75.6501, 45.385],
    [-75.6501, 45.415],
  ]),
}

describe('streetAlong', () => {
  it('takes the street the project runs along, not the one it crosses', () => {
    expect(streetAlong([-75.65, 45.4], project, [crossing, along])).toBe('St. Laurent Boulevard')
  })

  it('gives none where the project crosses open ground', () => {
    expect(streetAlong([-75.65, 45.4], project, [crossing])).toBeNull()
  })

  it('takes the nearest street for a point project', () => {
    expect(streetAlong([-75.65, 45.4], { type: 'Point', coordinates: [-75.65, 45.4] }, [crossing])).toBe('Hemlock Road')
  })

  it('leaves out streets too far away', () => {
    const far = {
      name: 'Far Street',
      geometry: line([
        [-75.66, 45.39],
        [-75.66, 45.41],
      ]),
    }
    expect(streetAlong([-75.65, 45.4], project, [far])).toBeNull()
  })
})
