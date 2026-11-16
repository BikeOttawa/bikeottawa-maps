import { describe, expect, it } from 'vitest'
import { distanceByPart, partOf } from './breakdown'
import type { Route, RouteSegment } from './brouter'

const stretch = (tags: Record<string, string>, extra: Partial<RouteSegment> = {}): RouteSegment => ({
  coords: [],
  distance: 100,
  lts: 2,
  walk: null,
  tags,
  reversed: false,
  ...extra,
})

describe('route breakdown', () => {
  it('sorts the bike infrastructure ridden', () => {
    const bikeway = (tags: Record<string, string>, extra?: Partial<RouteSegment>) =>
      partOf(stretch(tags, extra), 'bikeway')
    expect(bikeway({ highway: 'cycleway' })).toBe('path')
    expect(bikeway({ highway: 'footway', footway: 'crossing', bicycle: 'yes' })).toBe('path')
    expect(bikeway({ highway: 'secondary', cycleway: 'track' })).toBe('path')
    expect(bikeway({ highway: 'secondary', cycleway: 'lane' })).toBe('lane')
    expect(bikeway({ highway: 'secondary', 'cycleway:both': 'shoulder' })).toBe('shoulder')
    expect(bikeway({ highway: 'residential', cycleway: 'shared_lane' })).toBe('traffic')
    expect(bikeway({ highway: 'residential' })).toBe('traffic')
    expect(bikeway({ highway: 'footway', footway: 'sidewalk' }, { lts: 0, walk: 'sidewalk' })).toBe('walk')
  })

  it('counts a lane only on the side being ridden', () => {
    const tags = { highway: 'tertiary', 'cycleway:right': 'lane' }
    expect(partOf(stretch(tags), 'bikeway')).toBe('lane')
    expect(partOf(stretch(tags, { reversed: true }), 'bikeway')).toBe('traffic')
    expect(partOf(stretch({ ...tags, 'cycleway:left': 'shoulder' }, { reversed: true }), 'bikeway')).toBe('shoulder')
  })

  it('on a one-way street, takes a lane with the traffic and a contraflow one against it', () => {
    const oneway = { highway: 'residential', oneway: 'yes', 'oneway:bicycle': 'no' }
    expect(partOf(stretch({ ...oneway, 'cycleway:left': 'lane' }), 'bikeway')).toBe('lane')
    expect(partOf(stretch({ ...oneway, 'cycleway:left': 'lane' }, { reversed: true }), 'bikeway')).toBe('traffic')
    expect(partOf(stretch({ ...oneway, cycleway: 'opposite_lane' }, { reversed: true }), 'bikeway')).toBe('lane')
    expect(partOf(stretch({ ...oneway, cycleway: 'opposite_lane' }), 'bikeway')).toBe('traffic')
  })

  it('groups surfaces as the pathways layer does, taking streets without a tag to be paved', () => {
    const surface = (tags: Record<string, string>) => partOf(stretch(tags), 'surface')
    expect(surface({ highway: 'path', surface: 'fine_gravel' })).toBe('stone_dust')
    expect(surface({ highway: 'path', surface: 'gravel;asphalt' })).toBe('gravel')
    expect(surface({ highway: 'path' })).toBe('unknown')
    expect(surface({ highway: 'residential' })).toBe('paved')
    expect(surface({ highway: 'footway', footway: 'sidewalk' })).toBe('paved')
    expect(surface({ highway: 'residential', surface: 'unpaved' })).toBe('gravel')
  })

  it('reads lighting', () => {
    const lit = (value?: string) => partOf(stretch({ highway: 'path', ...(value && { lit: value }) }), 'lit')
    expect([lit('yes'), lit('24/7'), lit('no'), lit()]).toEqual(['yes', 'yes', 'no', 'unknown'])
  })

  it('takes paved streets and sidewalks to be plowed, unpaved paths not, and the rest as tagged', () => {
    const winter = (tags: Record<string, string>) => partOf(stretch(tags), 'winter')
    expect(winter({ highway: 'secondary' })).toBe('yes')
    expect(winter({ highway: 'residential', surface: 'asphalt' })).toBe('yes')
    expect(winter({ highway: 'footway', footway: 'sidewalk' })).toBe('yes')
    expect(winter({ highway: 'unclassified', surface: 'gravel' })).toBe('unknown')
    expect(winter({ highway: 'residential', surface: 'dirt', winter_service: 'yes' })).toBe('yes')
    expect(winter({ highway: 'cycleway', winter_service: 'yes' })).toBe('yes')
    expect(winter({ highway: 'cycleway', winter_service: 'no' })).toBe('no')
    expect(winter({ highway: 'path', surface: 'gravel' })).toBe('no')
    expect(winter({ highway: 'track', surface: 'dirt' })).toBe('no')
    expect(winter({ highway: 'cycleway', surface: 'asphalt' })).toBe('unknown')
    expect(winter({ highway: 'cycleway' })).toBe('unknown')
  })

  it('adds up the distance in each part', () => {
    const route = {
      segments: [
        stretch({ highway: 'cycleway' }),
        stretch({ highway: 'residential' }, { distance: 50 }),
        stretch({ highway: 'path' }),
      ],
    } as Route
    expect(Object.fromEntries(distanceByPart(route, 'bikeway'))).toEqual({ path: 200, traffic: 50 })
  })
})
