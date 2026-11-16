# Bike Ottawa Maps

Cycling maps for Ottawa–Gatineau built on OpenStreetMap: places such as bike parking, repair stations and water, pathways by surface and width, street comfort (level of traffic stress), winter-maintained pathways, a night map of lit streets and street lights, and collisions involving cyclists and pedestrians. Over any of them go bike lanes, signed bike routes and wards. A route planner rides or walks between places, and "How far" shows where you get in 5 to 30 minutes. Successor to [maps.bikeottawa.ca](https://maps.bikeottawa.ca).

No map vendor or API keys: the basemap and data layers are static [PMTiles](https://docs.protomaps.com/pmtiles/) files rendered with [MapLibre](https://maplibre.org). The light, grey and dark map styles are the same basemap tiles restyled in the browser; only the satellite style loads from elsewhere (Esri World Imagery, no key).

The site installs as an app on phones and desktops (`vite-plugin-pwa` in `web/vite.config.ts`). Its service worker keeps the app's own files, so it opens offline; tiles, routing and search always need the network. A new version takes over once the app has been closed.

## Layout

| Path          | What                                                                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `web/`        | The app: React, TypeScript, Vite, MapLibre                                                                                                             |
| `pipeline/`   | Builds the map tiles from OSM extracts (osmium, [stressmodel](https://github.com/BikeOttawa/stressmodel), tippecanoe) and fetches collisions and wards |
| `routing/`    | The route planner's backend: [BRouter](https://github.com/abrensch/brouter) with the `ottbike` and `ottwalk` profiles and routing data for the region  |
| `docker/`     | nginx config for the site image                                                                                                                        |
| `docs/`       | Longer guides: [deployment](docs/deployment.md)                                                                                                        |
| `region.json` | Area covered and the OSM extracts to use                                                                                                               |

## Getting started

```sh
brew install osmium-tool tippecanoe pmtiles
pipx install osmium   # pyosmium-up-to-date
npm install
npm run basemap   # once: basemap extract, fonts and icons
npm run tiles     # data layers from current OSM data
npm run dev
```

Tiles land in `web/public/tiles` and are not committed. The app only loads the files the current layer draws, so the first visit fetches the basemap alone.

| File                 | What                                                                                |
| -------------------- | ----------------------------------------------------------------------------------- |
| `basemap.pmtiles`    | Protomaps basemap                                                                   |
| `overlays.pmtiles`   | Streets and paths, for Comfort, Pathways, Winter and the bike lanes                 |
| `places.pmtiles`     | Places                                                                              |
| `night.pmtiles`      | Lit streets and street lamps                                                        |
| `routes.pmtiles`     | Signed bike routes, with `routes.json` listing the routes                           |
| `places/<kind>.json` | Each kind of place as flat `[lon, lat, …]` arrays, for counting places within reach |
| `meta.json`          | Date of the OSM data, when the tiles were built, km of pathway                      |

## OSM data

`pipeline/update-osm.sh` (`npm run osm`, also run by `npm run tiles`) keeps one file, `.cache/osm/region.osm.pbf`, with all OSM data for the routing area in `region.json`. The map tiles and the router are both built from it.

The first run downloads the Ontario and Quebec extracts from Geofabrik (2.2 GB) and cuts the area out. After that it only fetches OpenStreetMap's hourly change files, applies them and trims the result back to the area, so the data is about an hour behind OSM and a day's update is around 100 MB.

`region.json` has two boxes: `bbox` is what the map shows, `routingBbox` is the wider area routes can cross.

## Layers

**Pathways** shows every path bikes are not kept off (cycleways, paths unless `bicycle=no`, footways and sidewalks with `bicycle=yes`), coloured by surface (paved, stone dust, gravel, dirt) or by width, and drawn as wide as `cycleway:width` or `width` says (1.5 m without either). Where the surface or width is not tagged the line is yellow, so the layer doubles as a list of what is left to map. Filters pick surfaces, a least width and a least length. The length is that of the island a way is part of: every pathway joined to it at a shared node or through a crossing (`pipeline/islands.mjs`), so short stubs can be hidden; 300 m by default. Cards show the way's current tags from the OSM API and link to the editor. The bike lanes overlay starts off on this layer each time it is picked, and can be turned back on.

**Collisions** shows the City of Ottawa's reported traffic collisions that involve a cyclist or a pedestrian, 2017 to 2024, grouped by spot ([open data](https://open.ottawa.ca/), Open Government Licence – Ottawa). 2023 is missing from the city's data. The legend filters them:

- cyclists or pedestrians;
- years, on a slider with a month-by-month timeline above it (clicking a year shows that year alone);
- worst injury and circumstances (light, weather, road, impact, traffic control), as bars that each pick their group. Once something else is picked, a tick on each bar marks the group as it was before, so the pick shows how those collisions differ;
- the fewest collisions a spot needs to stay on the map.

The data is kept in the repository as `web/public/data/collisions.geojson`, about 3,500 points. The city publishes a new year each summer; `npm run collisions` downloads it again.

## Overlays

Switches in the map style menu draw these over any layer:

- **Bike lanes** (on by default), as Google Maps does: segregated cycleways and pathways dark green, painted lanes (`cycleway*=lane`) a lighter green in dashes, shared lanes that green in dots, paved shoulders meant for riding (`cycleway*=shoulder`) yellow. Streets get a line down each side that has a lane. Lines are as wide as the bikeway (`cycleway:width`, else `width`; without a tag 3 m for a two-way path, 1.5 m for a one-way one, a lane or a shoulder).
- **Bike routes** (off by default): signed routes from OSM route relations (`route=bicycle` and `route=mtb`) as wide soft bands under the bike lanes, coloured by rank: national (`ncn`: Trans Canada Trail, Route Verte), regional (`rcn`: Capital Pathway, Ottawa Valley Recreation Trail), local (`lcn`: Crosstown Bikeways and named pathways) and mountain-bike trails. Routes nest, so a way takes the rank of the most important route it is part of. Clicking one lists its routes with their length here and the routes they are part of, and picks out the one chosen.
- **Wards** (off by default): Ottawa's 24 wards in plum and Gatineau's 19 districts in teal, each named with its councillor. `npm run wards` (`pipeline/fetch-wards.mjs`) fetches them from the City of Ottawa (Wards 2026-2030 and Elected Officials, Open Government Licence – Ottawa) and the Ville de Gatineau (Districts électoraux, CC BY 4.0) and writes `web/public/data/wards.geojson`, which is committed.

## Route planner

The planner asks a BRouter server for routes. Riding styles are sets of weights for the `ottbike` profile in `routing/profiles` (how hard to avoid busy roads, sidewalks, rough surfaces, unplowed paths, unlit sections and stops) plus a riding speed on the flat; they live in `web/src/route/styles.ts`. Travel times also count walking pace where the bike is pushed and the seconds lost at stop signs and signals. Walking uses its own profile, `ottwalk` (sidewalks and paths first, busy roads without a sidewalk avoided; a winter switch avoids unplowed paths and walks them slowly).

A bike route's card splits it by one of these, from the tags BRouter returns for each stretch (`web/src/route/breakdown.ts`), and the route line takes the same colours:

- **Comfort**: level of traffic stress;
- **Bikeways**: pathways and cycle tracks, painted lanes, paved shoulders (on the side ridden) or shared with cars;
- **Surface**: grouped as on the Pathways layer (`pipeline/surface-groups.json`); streets without a tag count as paved;
- **Lighting**: `lit`;
- **Snow**: `winter_service` where tagged; otherwise paved streets and sidewalks count as plowed, unpaved streets as unknown and unpaved paths as not plowed, as on the Winter layer.

The card also counts the stop signs, traffic lights and barriers on the route, and each shows on the map. Barriers are nodes tagged `barrier` that a bike cannot simply ride through (bollards, gates, cycle barriers, blocks, stiles and the like) and raised kerbs (`kerb=raised`): worth knowing with a cargo bike or a trailer.

Place search (on the map and in the planner) and the addresses shown for points picked on the map come from [Photon](https://photon.komoot.io); set `VITE_GEOCODER_URL` to use another Photon server. Without `VITE_ROUTER_URL` the "Plan a route" page says that no routing server is connected.

### How far

"How far" uses the same router and riding styles. BRouter has no isochrones of its own, so the router image starts from our fork's image, `ghcr.io/yaroshkvorets/brouter:bikeottawa`, built from the `bikeottawa` branch of [the fork](https://github.com/YaroShkvorets/brouter/tree/bikeottawa). It adds three things to upstream BRouter:

- `engineMode=5` with `isochroneTime=<seconds>` (up to 1800), which spreads out from one point along the cheapest paths of the profile and returns every way reached as GeoJSON, one MultiLineString per minute;
- the profiles' `stopdelay` (seconds lost at stop signs and signals) added to travel times;
- per-way speed limits (`maxspeed`) applied to walking as well as riding.

Every push to that branch publishes a new image. To move to a newer BRouter, rebase the branch onto upstream, push, and pin the new image digest as `BROUTER_IMAGE` in `routing/Dockerfile`.

The app works out the area reached on a 25 m grid: the cells the ways pass through plus those they close off from the outside. It counts the places picked on the Places layer that fall within 50 m of that area, from `tiles/places/<kind>.json`.

### Running the router

The router image builds its own routing data from the same OSM file, because it needs tags that stock BRouter data leaves out (`winter_service`, `width`, lane counts, `crossing:signals`). To run it locally:

```sh
npm run router:build   # elevation tiles and the image, with routing data built inside it
npm run router         # BRouter on localhost:17777, using the profiles from the checkout
npm run dev            # .env.development points the app at it
```

`npm run router` mounts the two profiles in `routing/profiles` into the container, so profile edits take effect on the next route request; rebuild the image only for fresh OSM data or new lookup tags.

Elevation comes from NRCan's [MRDEM-30](https://datacube.services.geo.ca/stac/api/collections/mrdem-30) terrain model (bare ground, lidar-based around Ottawa–Gatineau; Open Government Licence – Canada), resampled to 1-arcsecond tiles with GDAL; SRTM fills in outside Canada.

## Photos

Cards for places and streets show street-level photos from [Mapillary](https://www.mapillary.com): a place's own photo when its OSM `mapillary` tag names one, then the photos taken nearby (the closest of each capture run), which the larger view steps through. They need a Mapillary client token in `VITE_MAPILLARY_TOKEN` (for local work, in `web/.env.development.local`, which git ignores); without one, cards link to the photo instead. Places also show the Fotoshi photos their `image:fotoshi` tag names (no key needed), and their `image` tag when it is a picture. Photos are only requested once a card is open.

## Deployment

[docs/deployment.md](docs/deployment.md) explains step by step how to run it on one machine, or the site on GitHub Pages and the router on Google Cloud Run, and how to move it to maps.bikeottawa.ca.

The `Deploy` workflow runs on every push to `main`, on `v*` tags and nightly. Each job brings the OSM data up to date (the file is carried between runs in the Actions cache).

- `site` runs lint and tests, rebuilds the tiles and the app, and pushes the site image, `ghcr.io/yaroshkvorets/bikeottawa-maps`, with the tiles baked in.
- `router`, alongside it, pushes the router image, `ghcr.io/yaroshkvorets/bikeottawa-maps-router`, with fresh routing data.
- `deploy` publishes the site to GitHub Pages once `site` has passed, a few minutes after a push.

Images are tagged `main`, or the version and `latest` for a `v*` tag. Repository variables set what the site connects to: `ROUTER_URL` (the planner works once it points at a running router) and `MAPILLARY_TOKEN` (photos).

`compose.yml` runs both images on one machine, with the site proxying `/brouter` to the router:

```sh
docker compose up -d                          # http://localhost:8080
docker compose pull && docker compose up -d   # pick up the nightly data
```

## Scripts

- `npm run dev` / `npm run build`: run or build the app
- `npm test`: unit tests for the app (Vitest) and the pipeline (`node --test`)
- `npm run lint` / `npm run format`: check or fix with Biome
- `npm run typecheck`: TypeScript check of the app
- `npm run tiles` / `npm run basemap`: rebuild the tiles
- `npm run osm`: bring the OSM data up to date without rebuilding anything
- `npm run collisions` / `npm run wards`: download the city data again
- `npm run router:build` / `npm run router`: build and run the local router

## Roadmap

1. Editing from the map (plowed or not, parking details) saved to OpenStreetMap
2. Planner: turn-by-turn, a gravel style, via points on touch screens
3. Collisions in Gatineau (no open data yet), offline use
