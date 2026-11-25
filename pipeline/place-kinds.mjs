/**
 * Which OSM tags make which kind of place: for the tiles (classify.mjs), and
 * for places added from the site (web/src/editFields.ts), which tags a new one
 * with the first row of its kind that needs nothing more.
 *
 * [OSM key, value, our kind, zoom from which it shows, what else it needs].
 * Several tags can map to one kind. Most kinds show from as far out as the map
 * goes (zoom 9); only kinds with thousands of places wait until closer in, so
 * that zoomed-out tiles stay small. What else a row needs is checked in
 * classify.mjs: `named`, `sight`, `usefulStore` or `bikeRamp`.
 */
export const PLACE_KINDS = [
  ['amenity', 'bicycle_parking', 'parking', 12],
  ['shop', 'bicycle', 'shop', 9],
  ['amenity', 'bicycle_repair_station', 'repair', 9],
  ['amenity', 'compressed_air', 'air', 9],
  ['amenity', 'bicycle_rental', 'rental', 9],
  ['amenity', 'drinking_water', 'water', 9],
  ['amenity', 'toilets', 'toilets', 10],
  ['amenity', 'shelter', 'shelter', 10],
  ['amenity', 'telephone', 'telephone', 9],
  ['tourism', 'information', 'information', 12],
  ['amenity', 'bench', 'bench', 13],
  ['leisure', 'picnic_table', 'picnic', 12],
  ['amenity', 'bbq', 'bbq', 9],
  ['tourism', 'viewpoint', 'viewpoint', 9],
  ['tourism', 'artwork', 'artwork', 9],
  ['historic', 'memorial', 'artwork', 9, 'sight'],
  // Unnamed monuments are mostly the parts of one, mapped for 3D.
  ['historic', 'monument', 'artwork', 9, 'named'],
  ['leisure', 'splash_pad', 'splash', 9],
  ['playground', 'splash_pad', 'splash', 9],
  // Unnamed beaches are strips of sand, not places to stop.
  ['natural', 'beach', 'beach', 9, 'named'],
  ['leisure', 'swimming_area', 'beach', 9],
  ['tourism', 'camp_site', 'camping', 9],
  ['amenity', 'cafe', 'cafe', 10],
  ['amenity', 'restaurant', 'restaurant', 12],
  ['amenity', 'fast_food', 'fast_food', 12],
  ['amenity', 'ice_cream', 'ice_cream', 9],
  ['amenity', 'pub', 'pub', 9],
  ['craft', 'brewery', 'brewery', 9],
  ['shop', 'bakery', 'bakery', 9],
  ['amenity', 'marketplace', 'market', 9],
  ['shop', 'supermarket', 'grocery', 9],
  ['shop', 'convenience', 'convenience', 11],
  // Out of town a gas station is often the only place to get water or a snack.
  ['amenity', 'fuel', 'convenience', 11],
  ['shop', 'variety_store', 'general', 9],
  ['shop', 'general', 'general', 9],
  // Department stores are mostly fashion; a few chains carry everyday and bike supplies.
  ['shop', 'department_store', 'general', 9, 'usefulStore'],
  ['amenity', 'pharmacy', 'pharmacy', 10],
  ['railway', 'station', 'station', 9],
  ['amenity', 'ferry_terminal', 'ferry', 9],
  ['barrier', 'cycle_barrier', 'barrier', 12],
  ['barrier', 'motorcycle_barrier', 'barrier', 12],
  ['barrier', 'kissing_gate', 'barrier', 12],
  ['highway', 'elevator', 'elevator', 9],
  // Stairs are lines; the ones with a ramp to push a bike up are worth knowing about.
  ['highway', 'steps', 'ramp', 9, 'bikeRamp'],
]
