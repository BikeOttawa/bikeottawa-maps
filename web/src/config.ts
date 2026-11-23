/** Where the pipeline output is served from. Override with VITE_ASSETS_BASE to use a CDN. */
export const ASSETS_BASE: string = new URL(
  import.meta.env.VITE_ASSETS_BASE ?? import.meta.env.BASE_URL,
  window.location.href,
).href.replace(/\/$/, '')

/**
 * Mapillary client token, to show the street-level photo a place links to.
 * Without one, place cards link to the photo instead.
 */
export const MAPILLARY_TOKEN: string | null = import.meta.env.VITE_MAPILLARY_TOKEN || null

/**
 * Fotoshi browser key, approved by Fotoshi for this site's address, to show
 * the Fotoshi photos of what a card is about. Without one, cards show only
 * those a place's `image:fotoshi` tag names.
 */
export const FOTOSHI_KEY: string | null = import.meta.env.VITE_FOTOSHI_KEY || null

/** Where the app's own data files (public/data) are served: always next to the app. */
export const DATA_BASE: string = new URL(import.meta.env.BASE_URL, window.location.href).href.replace(/\/$/, '')

/** BRouter endpoint for the route planner; the planner is hidden when unset. */
export const ROUTER_URL: string | null = import.meta.env.VITE_ROUTER_URL
  ? new URL(import.meta.env.VITE_ROUTER_URL, window.location.href).href
  : null

/** OpenStreetMap, which cards edit and leave notes on: the real map, there is no other. */
export const OSM_URL = 'https://www.openstreetmap.org'
export const OSM_API = 'https://api.openstreetmap.org/api/0.6'

/** The OAuth 2 app registered on openstreetmap.org for this site. Cards offer no editing without one; notes need none. */
export const OSM_CLIENT_ID: string | null = import.meta.env.VITE_OSM_CLIENT_ID || null
