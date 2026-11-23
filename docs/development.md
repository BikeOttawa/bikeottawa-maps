# Development

Setup and checks are in [CONTRIBUTING.md](../CONTRIBUTING.md).

## Layout

| Path        | What                                                                               |
| ----------- | ---------------------------------------------------------------------------------- |
| `web/`      | The app: React, TypeScript, Vite, MapLibre                                         |
| `pipeline/` | Builds the tiles from OSM and fetches the city and police data                     |
| `routing/`  | The router: BRouter with the region's profiles                                     |
| `docker/`   | nginx config for the site image                                                    |
| `docs/`     | [How it works](how-it-works.md), this page, [deployment](deployment.md)            |
| `regions/`  | One folder per city: area, names, logo, profiles ([details](../regions/README.md)) |

## Tiles

Built into `web/public/tiles`, not committed. The app loads only what the current layer draws.

| File                   | What                                                |
| ---------------------- | --------------------------------------------------- |
| `basemap.pmtiles`      | Protomaps basemap (`npm run basemap`)               |
| `overlays.pmtiles`     | Streets and paths: Comfort, Pathways, bike lanes    |
| `places.pmtiles`       | Places                                              |
| `places/<kind>.json`   | Each kind of place as `[lon, lat, …]`, for merging  |
| `night.pmtiles`        | Lit ways and street lamps                           |
| `routes.pmtiles`       | Bike routes, with `routes.json` listing them        |
| `meta.json`            | OSM data date, build time, km per band for legends  |
| `construction.geojson` | The City's construction forecast, if Projects is on |

## OSM data

- `npm run osm` (also run by `npm run tiles`) keeps `.cache/osm/region.osm.pbf`, the source of both the tiles and the router.
- The first run downloads the Ontario and Quebec extracts (2.2 GB). After that it applies OSM's hourly changes: about an hour behind OSM, about 100 MB a day.

## The router

```sh
npm run router:build   # elevation and the image, with routing data built inside
npm run router         # BRouter on localhost:17777
npm run dev            # .env.development points the app at it
```

- The routing data is built from the same OSM file, to keep tags stock BRouter data drops (`winter_service`, `width`, lanes, `crossing:signals`).
- `npm run router` mounts the region's `profiles`, so profile edits apply on the next request. Rebuild only for fresh data or new lookup tags.
- Elevation: NRCan MRDEM-30, SRTM outside Canada.
- The image builds on our [BRouter fork](https://github.com/YaroShkvorets/brouter/tree/bikeottawa) (`ghcr.io/yaroshkvorets/brouter:bikeottawa`), which adds [How far](how-it-works.md#how-far). To update BRouter: rebase the `bikeottawa` branch on upstream, push, and pin the new digest as `BROUTER_IMAGE` in `routing/Dockerfile`.

## Scripts

| Script                                          | What                                      |
| ----------------------------------------------- | ----------------------------------------- |
| `dev`, `build`                                  | Run or build the app                      |
| `test`                                          | Vitest (app) and `node --test` (pipeline) |
| `lint`, `format`, `typecheck`                   | Biome and TypeScript                      |
| `tiles`, `basemap`                              | Rebuild the tiles                         |
| `osm`                                           | Update the OSM data only                  |
| `collisions`, `thefts`, `wards`, `construction` | Fetch the city and police data again      |
| `router:build`, `router`                        | Build and run the local router            |

Every push to `main` deploys the site and the router; see [deployment.md](deployment.md).
