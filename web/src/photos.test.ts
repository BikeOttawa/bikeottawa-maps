import { describe, expect, it } from 'vitest'
import {
  commonsLink,
  directImage,
  fotoshiIds,
  fotoshiOsmId,
  fotoshiPhoto,
  fotoshiSearchUrl,
  imageLink,
  mapillaryId,
  mapillaryViewerUrl,
  nearbyImages,
  parseFotoshiPhotos,
  streetViewUrl,
} from './photos'

describe('mapillaryId', () => {
  it('takes the first image id from the tag', () => {
    expect(mapillaryId('262623838945219')).toBe('262623838945219')
    expect(mapillaryId('262623838945219;468355031124550')).toBe('262623838945219')
  })
  it('ignores what is not an image id', () => {
    expect(mapillaryId(undefined)).toBeNull()
    expect(mapillaryId('yes')).toBeNull()
    expect(mapillaryId('https://www.mapillary.com/app/?pKey=1')).toBeNull()
  })
  it('links to the viewer', () => {
    expect(mapillaryViewerUrl('262623838945219')).toBe(
      'https://www.mapillary.com/app/?pKey=262623838945219&focus=photo',
    )
  })
})

describe('fotoshiIds', () => {
  it('takes every photo id from the tag', () => {
    expect(fotoshiIds('Jf8bfHzP0OmzWMEkzN3TWUB4')).toEqual(['Jf8bfHzP0OmzWMEkzN3TWUB4'])
    expect(fotoshiIds('XREh69r4XvdV3QA7T6GqNUbE; mQXlxZPoNpgV7S8XBdGExXt8')).toEqual([
      'XREh69r4XvdV3QA7T6GqNUbE',
      'mQXlxZPoNpgV7S8XBdGExXt8',
    ])
  })
  it('ignores what is not a photo id', () => {
    expect(fotoshiIds(undefined)).toEqual([])
    expect(fotoshiIds('yes')).toEqual([])
    expect(fotoshiIds('https://fto.sh/i/E7Xxf8qX')).toEqual([])
  })
  it('shows the photo from the CDN and links to its page', () => {
    expect(fotoshiPhoto('Jf8bfHzP0OmzWMEkzN3TWUB4')).toEqual({
      url: 'https://cdn.fotoshi.com/images/Jf8bfHzP0OmzWMEkzN3TWUB4-640.jpeg',
      largeUrl: 'https://cdn.fotoshi.com/images/Jf8bfHzP0OmzWMEkzN3TWUB4-2048.jpeg',
      credit: 'Fotoshi · CC BY 4.0',
      link: 'https://fotoshi.com/photo/Jf8bfHzP0OmzWMEkzN3TWUB4',
    })
  })
})

describe('imageLink', () => {
  it('accepts only web links', () => {
    expect(imageLink('https://example.org/bench.jpg')).toBe('https://example.org/bench.jpg')
    expect(imageLink('File:Bench.jpg')).toBeNull()
    expect(imageLink('javascript:alert(1)')).toBeNull()
  })
})

describe('directImage', () => {
  it('takes links that are pictures, not pages', () => {
    const osc = 'https://storage6.openstreetcam.org/files/photo/2017/10/4/lth/931937_73f33_38.jpg'
    expect(directImage(osc)).toBe(osc)
    expect(directImage('https://photos.app.goo.gl/abc123')).toBeNull()
  })
})

describe('commonsLink', () => {
  it('links files and categories', () => {
    expect(commonsLink('Category:Greenboro Station')).toBe(
      'https://commons.wikimedia.org/wiki/Category:Greenboro_Station',
    )
    expect(commonsLink('Bench.jpg')).toBeNull()
  })
})

describe('streetViewUrl', () => {
  it('opens Street View nearest the point', () => {
    expect(streetViewUrl([-75.69485, 45.42021])).toBe(
      'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=45.420210,-75.694850',
    )
  })
})

describe('nearbyImages', () => {
  const at: [number, number] = [-75.69485, 45.42021]
  const image = (id: string, dLat: number, sequence: string, pano = false) => ({
    id,
    computed_geometry: { coordinates: [at[0], at[1] + dLat] as [number, number] },
    is_pano: pano,
    sequence,
  })
  it('lists the closest photo of each capture run, nearest first', () => {
    const found = nearbyImages([image('a2', 0.0002, 'a'), image('a1', 0.0001, 'a'), image('b1', 0.00015, 'b')], at)
    expect(found.map((f) => f.id)).toEqual(['a1', 'b1'])
    expect(Math.round(found[0].distance)).toBe(11)
  })
  it('puts flat photos ahead of panoramas about as close', () => {
    // A panorama 5 m away comes after a flat photo 11 m away.
    expect(nearbyImages([image('pano', 0.000045, 'p', true), image('flat', 0.0001, 'f')], at)[0].id).toBe('flat')
    expect(nearbyImages([], at)).toEqual([])
  })
})

describe('fotoshi search', () => {
  it('takes a place by its OSM object, typed', () => {
    expect(fotoshiOsmId('way/204781910')).toBe('w204781910')
    expect(fotoshiOsmId('node/1')).toBe('n1')
    for (const bad of ['', 'way/0', 'way/-1', '123', 'way/1&radius=5', undefined]) expect(fotoshiOsmId(bad)).toBeNull()
    expect(fotoshiSearchUrl({ osmId: 'n42' })).toBe(
      'https://api.fotoshi.com/v1/data/photos?osm_id=n42&limit=10&photo_size=thumbnail%2C1280',
    )
  })

  it('takes anything else by a circle around where it is', () => {
    expect(fotoshiSearchUrl({ at: [-75.69809, 45.42359] })).toBe(
      'https://api.fotoshi.com/v1/data/photos?lon=-75.698090&lat=45.423590&radius=30&limit=10&photo_size=thumbnail%2C1280',
    )
  })

  const shot = (id: string, extra: Record<string, unknown> = {}, where: [number, number] = [-75.7, 45.4]) => ({
    id,
    geometry: { type: 'Point', coordinates: where },
    properties: {
      username: 'mapper',
      creator_name: 'Photo author',
      image_license: 'CC-BY-4.0',
      captured_at: '2026-07-29',
      assets: {
        thumbnail: { href: 'https://cdn.example/t.jpeg' },
        'image-1280': { href: 'https://cdn.example/l.jpeg' },
      },
      ...extra,
    },
  })
  const answer = (...features: unknown[]) => ({ type: 'FeatureCollection', features })

  it('credits each photo and links its page', () => {
    const [found] = parseFotoshiPhotos(answer(shot('abc123')))
    expect(found.photo).toEqual({
      url: 'https://cdn.example/l.jpeg',
      largeUrl: 'https://cdn.example/l.jpeg',
      credit: '© Photo author · Fotoshi · CC BY 4.0',
      link: 'https://fotoshi.com/photo/abc123',
      takenAt: Date.parse('2026-07-29T12:00:00'),
    })
    expect(found.distance).toBeUndefined()
  })

  it('orders photos around a point closest first, once each', () => {
    const near = parseFotoshiPhotos(
      answer(shot('far', {}, [-75.7, 45.4002]), shot('close', {}, [-75.7, 45.40001]), shot('close')),
      [-75.7, 45.4],
    )
    expect(near.map((n) => n.photo.link.split('/').pop())).toEqual(['close', 'far'])
    expect(near[1].distance).toBeCloseTo(22, 0)
  })

  it('leaves out photos without an https image, a licence or a credit', () => {
    const http = shot('a', { assets: { 'image-1280': { href: 'http://cdn.example/l.jpeg' } } })
    const unlicensed = shot('b', { image_license: null })
    const anonymous = shot('c', { creator_name: null, username: null })
    const odd = shot('../d')
    expect(parseFotoshiPhotos(answer(http, unlicensed, anonymous, odd))).toEqual([])
    expect(parseFotoshiPhotos({ error: 'quota' })).toEqual([])
    expect(parseFotoshiPhotos(null)).toEqual([])
  })
})
