import { describe, expect, it } from 'vitest'
import { OLD_PAGES, oldPageHtml, oldPageTarget } from './oldSite'

describe('old site pages', () => {
  it('open the matching map', () => {
    expect(oldPageTarget('', OLD_PAGES.winter)).toBe('../#layer=winter')
    expect(oldPageTarget('', OLD_PAGES.isochrones)).toBe('../#mode=reach')
    expect(oldPageTarget('', OLD_PAGES.desire)).toBe('../')
  })

  it('keep the old view', () => {
    expect(oldPageTarget('?lat=45.42&lng=-75.69&zoom=15', OLD_PAGES.lts)).toBe('../#map=15/45.42/-75.69&layer=comfort')
    expect(oldPageTarget('?lng=-75.69&lat=45.42', OLD_PAGES.desire)).toBe('../#map=18/45.42/-75.69')
    expect(oldPageTarget('?lat=north&lng=-75.69', OLD_PAGES.pathways)).toBe('../#layer=pathways')
  })

  it('run the same code in the page', () => {
    const html = oldPageHtml(OLD_PAGES.lts)
    const script = html.match(/<script>(.*)<\/script>/s)?.[1] ?? ''
    let went = ''
    const location = {
      search: '?lat=45.4&lng=-75.7&zoom=14',
      replace: (to: string) => {
        went = to
      },
    }
    new Function('location', script)(location)
    expect(went).toBe('../#map=14/45.4/-75.7&layer=comfort')
    expect(html).toContain('content="0; url=../#layer=comfort"')
  })
})
