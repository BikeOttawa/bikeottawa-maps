import region from '@region/region.json'
import type { Region } from '../../regions/region.mjs'

/**
 * The region the site is for: its area, names, links and what it shows, from
 * regions/<id>/region.json. `@region` is that folder, picked when the site is
 * built (regions/region.mjs); the tests always read Ottawa's.
 */
export const REGION: Region = region as typeof region & Pick<Region, 'bbox' | 'center' | 'routingBbox'>
