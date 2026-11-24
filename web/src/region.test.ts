import { describe, expect, it } from 'vitest'
import { creditLine, hasCityData, sourceLine } from './region'

describe('the region’s own wording', () => {
  it('credits whose data a layer shows, each name a link', () => {
    const line = creditLine('Wards', [
      { name: 'One City', url: 'https://one.example/' },
      { name: 'Ville Deux', url: 'https://deux.example/' },
    ])
    expect(line.replace(/<[^>]+>/g, '')).toBe('Wards: One City, Ville Deux')
    expect(line).toContain('<a href="https://deux.example/" target="_blank" rel="noopener">Ville Deux</a>')
    expect(creditLine('Wards', [])).toBe('')
    expect(creditLine('Wards')).toBe('')
  })

  it('names a legend’s source in the language shown, with its years and the region’s note', () => {
    expect(hasCityData('thefts')).toBe(true)
    expect(sourceLine('collisions', 'en', { first: 2017, last: 2024 })).toBe('City of Ottawa open data, 2017 to 2024.')
    expect(sourceLine('thefts', 'fr', { first: 2015, last: 2024 })).toBe(
      'Données ouvertes du Service de police d’Ottawa, de 2015 à 2024. La police place chaque vol à l’intersection la plus proche.',
    )
    expect(sourceLine('construction', 'en')).toBe('City of Ottawa construction forecast.')
    // Wards have no legend, so no source to name.
    expect(sourceLine('wards', 'en')).toBe('')
  })
})
