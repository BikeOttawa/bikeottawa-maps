import { describe, expect, it } from 'vitest'
import { layersShown } from './layers'

describe('layersShown', () => {
  it('shows only the OpenStreetMap layers when the city names none', () => {
    expect(layersShown(undefined)).toEqual(['places', 'pathways', 'comfort'])
    expect(layersShown([])).toEqual(['places', 'pathways', 'comfort'])
  })

  it('adds the city layers named, in the usual order', () => {
    expect(layersShown(['thefts', 'collisions'])).toEqual(['places', 'pathways', 'comfort', 'collisions', 'thefts'])
  })

  it('ignores the city data that is not a layer', () => {
    expect(layersShown(['wards', 'construction'])).toEqual(['places', 'pathways', 'comfort', 'construction'])
  })
})
