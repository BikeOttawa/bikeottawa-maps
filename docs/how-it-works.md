# How the map works

## Basics

- Basemap and data layers are static [PMTiles](https://docs.protomaps.com/pmtiles/), drawn with [MapLibre](https://maplibre.org). Light, grey and dark restyle the same tiles; satellite is Esri World Imagery. No map vendor, no keys.
- The site installs as an app (`vite-plugin-pwa`) and opens offline. Tiles, routing and search need the network.
- Every legend works the same way: a row of bars per grouping, one row open at a time, and the open row colours the map. The URL keeps it (`comfort=by:speed`).
- Places, collisions and thefts merge into spots until zoom 15. Clicking a spot zooms in until it splits.

## Layers

Collisions, Thefts and Projects come from the city's own data, not OSM. So do the wards and roadwork overlays. The region's `cityData` names those the site shows, and its `pipeline/` fetches them; without it, none.

### Places

- Kinds and groups in `web/src/places.ts`, loaded from `tiles/places/<kind>.json`.
- Artwork: `tourism=artwork`, `historic=memorial` but for plaques, benches, trees and ghost bikes, and named `historic=monument`.
- Merged per group into circles sized by count; from zoom 15 each place has its own marker and card.

### Pathways

- Paths bikes aren't kept off: cycleways, paths unless `bicycle=no`, footways and sidewalks with `bicycle=yes`.
- Drawn as wide as `cycleway:width` or `width` (1.5 m without).
- Filters: surface, type, width, snow clearing (`winter_service`), smoothness, lighting. Not tagged is yellow: what's left to map.
- A least-length slider (300 m) hides short stubs, measured over the connected pathway network (`pipeline/islands.mjs`).
- Bands: `pipeline/pathway-bands.mjs`; km per combination in `meta.json`.

### Comfort

- Every street and path bikes may use, by level of traffic stress (1 to 4), from `pipeline/stressmodel.mjs` (first written as [stressmodel](https://github.com/BikeOttawa/stressmodel)).
- Filters: stress, type, speed limit, lanes each way, bike infrastructure, surface, lighting.
- Bands: `pipeline/comfort.mjs`; km per combination in `meta.json`.

### Collisions

- City of Ottawa, involving a cyclist or a pedestrian, 2017 to 2024 (2023 is missing from the city's data).
- Filters: years (slider and monthly timeline), who, severity, circumstances, least collisions per spot. Once something is picked, ticks mark each group's share before the pick.
- `npm run collisions` → `regions/ottawa/data/collisions.geojson` (committed). Records listed twice are dropped.

### Thefts

- Ottawa Police, bikes stolen 2018 to 2025, placed at intersections. Heat map zoomed out.
- Filters: year, where taken from, time of day, season, kind of bike, value, recovered, least thefts or value per intersection.
- `npm run thefts` → `regions/ottawa/data/thefts.geojson` (committed). Keeps stolen and recovered bikes only; no e-scooters, no copies.

### Projects

- The City's construction forecast: works under way or planned in the next three years. Buildings and parks left out.
- Filters: when, kind of work.
- `npm run construction`, run with the tiles → `tiles/construction.geojson`.

## Overlays

- **Bike lanes** (on): cycle tracks and pathways dark green, painted lanes dashed, shared lanes dotted, paved shoulders yellow. Width from the tags.
- **Bike routes**: OSM route relations, ranked national, regional, local and mountain bike.
- **Wards**: Ottawa's wards and Gatineau's districts with their councillors. `npm run wards` → `regions/ottawa/data/wards.geojson` (committed).
- **Roadwork**: today's closures, live from the City's traffic map and Québec 511, for the map's area only (`web/src/useClosures.ts`). Gatineau publishes none.
- **Street lights**: ways with `lit` or street lamps along half their length (`pipeline/lamps.mjs`), and the lamps.

## Route planner

- [BRouter](https://github.com/abrensch/brouter) with the region's profiles, `ottbike` and `ottwalk` for Ottawa (`regions/ottawa/profiles`). Riding styles are weights for the bike profile (`web/src/route/styles.ts`).
- Up to three routes: the best, then BRouter's `alternativeidx` 1 and 2. Much slower or overlapping ones are dropped (`web/src/route/alternatives.ts`). The URL keeps the pick (`alt=1`).
- A bike route's card splits it by comfort, bikeways, surface, lighting and snow (`web/src/route/breakdown.ts`), and counts stop signs, traffic lights, barriers and roadwork within 10 m (`web/src/route/roadwork.ts`).
- Search and addresses: [Photon](https://photon.komoot.io), two requests at a time. `VITE_GEOCODER_URL` picks another server.

## How far

- Our [BRouter fork](https://github.com/YaroShkvorets/brouter/tree/bikeottawa) adds:
  - `engineMode=5` with `isochroneTime` (up to 1800 s): every way reached, one MultiLineString per minute;
  - stop delays (`stopdelay`) in travel times;
  - speed limits for walking too.
- The area reached is a 25 m grid: cells the ways pass through plus those they enclose. Places picked on the Places layer within 50 m are counted.

## Editing

- Cards of paths, streets and most places set a few common tags in OSM, as the person signed in: for pathways surface, width, smoothness, lighting and snow clearing; for streets speed limit, lanes, surface, smoothness and lighting (`web/src/editFields.ts`). A tag is never removed.
- Sign-in is OAuth 2 with PKCE, in a popup that comes back to `land.html` (`web/src/osmAuth.ts`). Installed apps go to OSM and back in the same window instead.
- Edits go in one changeset per visit, tagged `created_by=BikeOttawa Maps` and `#BikeOttawa`, its comment listing the tags set. Someone else's edit in between reloads the form.
- Every card can leave an OSM note at the spot, anonymous without a sign-in.
- `VITE_OSM_CLIENT_ID` turns editing on. Edits go to the real OSM, also from a local run.

## Photos

Requested only when a card opens.

- **Mapillary**: the place's own `mapillary` photo, then the nearest photo of each capture run. Needs `VITE_MAPILLARY_TOKEN`; without it, cards link to the photos.
- **Fotoshi**: photos named in `image:fotoshi` (no key). With `VITE_FOTOSHI_KEY`, also a search: a place's by its OSM object, anything else's within 30 m.
- **`image` tag**, when it is a picture.
