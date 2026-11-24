/**
 * A site this one replaces may have had a page per map. The build writes a
 * small page at each of those paths (the region's `oldPages`, see
 * vite.config.ts) that sends visitors to the same map here, at the same place:
 * the old maps.bikeottawa.ca kept it as `?lat=…&lng=…&zoom=…`.
 */

/**
 * Where an old page sends visitors: the app one folder up, with the old view
 * as `map=zoom/lat/lng` (zoom 18 when it had none, as the old pages did).
 * Inlined into the pages, so it uses nothing from outside.
 */
export function oldPageTarget(search: string, to: string): string {
  const query = new URLSearchParams(search)
  const [lat, lng, zoom] = ['lat', 'lng', 'zoom'].map((key) => Number.parseFloat(query.get(key) ?? ''))
  const view =
    Number.isFinite(lat) && Number.isFinite(lng) ? `map=${Number.isFinite(zoom) ? zoom : 18}/${lat}/${lng}` : ''
  const hash = [view, to].filter(Boolean).join('&')
  return hash ? `../#${hash}` : '../'
}

/** An old path's page: off at once with JavaScript, by a refresh and a link without. */
export function oldPageHtml(to: string, title: string): string {
  const plain = oldPageTarget('', to)
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<title>${title}</title>
<script>location.replace((${oldPageTarget})(location.search, ${JSON.stringify(to)}))</script>
<noscript><meta http-equiv="refresh" content="0; url=${plain}"></noscript>
<p><a href="${plain}">${title}</a></p>
</html>
`
}
