# Montréal: a generic example

Montreal's region shows what the maps look like for a city with nothing of its own yet: OpenStreetMap data and the parts every region shares. It is a starting point, to be enriched with the city's own data, and is not deployed anywhere. Copy it to start a new city.

| Path          | What                                                                          |
| ------------- | ----------------------------------------------------------------------------- |
| `region.json` | Central Montreal, a box drawn by hand; Quebec's extract; a raspberry `accent` |
| `brand/`      | A plain bicycle in the accent colour, drawn for this example                  |
| `profiles/`   | `bike` and `walk`: copies of Ottawa's profiles, not tuned for Montreal        |

What it shows: Places, Pathways and Comfort from OSM, the basemap, and roadwork on the province's roads from the shared `quebec511` source. Collisions, Thefts, Projects and wards stay hidden, as `region.json` names no `cityData`. The router uses SRTM elevation only.

## Try it

Put `MAP_REGION=montreal` in `.env` at the top of the repository, then:

```sh
npm run basemap
npm run tiles          # the first run cuts Montreal from the Quebec extract
npm run router:build   # for routes
npm run router
npm run dev
```

The tiles and the router image are shared by every region: build them again after switching back to Ottawa. The OSM data is kept per region, so that is quick.

## Enriching it

Each of these is optional and switches on its part of the site; Ottawa's folder shows them all.

- **City data**: collisions, thefts, wards and construction projects, each fetched by a script in `pipeline/` into `data/` and named in `cityData` ([../README.md](../README.md) has the formats). Montréal's open data portal, [donnees.montreal.ca](https://donnees.montreal.ca), is the place to look.
- **Roadwork**: a source for the city's own closures in `web/src/roadwork/sources/`, added to `roadwork`.
- **Elevation**: a finer raster for the router; NRCan's MRDEM-30, which Ottawa uses, covers all of Canada.
- **Organization**: `org`, for the footer and the help card, its own logo and icons in `brand/`, and `ideas`, a form or page that takes people's ideas.
- **Profiles**: tune `bike` and `walk` for local streets.

## For a new city

1. Copy this folder to `regions/<id>/` and set `MAP_REGION=<id>`.
2. In `region.json`, set the names, `bbox` and `center`, a wider `routingBbox`, the Geofabrik extracts that cover it, and the time zone.
3. Replace the logo and icons in `brand/`, and set `accent` to the city's colour.
4. Name roadwork sources that cover the city, or remove `roadwork`.
5. Enrich it as above.
