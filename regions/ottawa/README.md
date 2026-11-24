# Ottawa–Gatineau

The region the live site is built for, [maps.bikeottawa.ca](https://maps.bikeottawa.ca), and the default when `MAP_REGION` is not set. The web tests always read it.

## What is here

| Path          | What                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------- |
| `region.json` | Ottawa–Gatineau's area, names and links (fields in [../README.md](../README.md))             |
| `brand/`      | Bike Ottawa's logo and icons                                                                 |
| `profiles/`   | `ottbike` and `ottwalk`, the router's profiles to ride and to walk                           |
| `pipeline/`   | The scripts that fetch the city and police data, and their tests                             |
| `data/`       | What those scripts wrote, committed: `collisions.geojson`, `thefts.geojson`, `wards.geojson` |

## Data

The OSM data is cut from Geofabrik's Ontario and Quebec extracts. Beyond it:

| Layer      | Source                                                     | Refresh                                                                                                                       |
| ---------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Collisions | City of Ottawa open data                                   | `npm run collisions` when the city publishes a year, usually each summer                                                      |
| Thefts     | Ottawa Police Service open data                            | `npm run thefts` when the police publish a year, then set `THEFT_YEARS` in `web/src/thefts.ts` to the years the script prints |
| Wards      | City of Ottawa wards, Ville de Gatineau districts          | `npm run wards` after an election or by-election; check the councillors it prints                                             |
| Projects   | City of Ottawa construction forecast                       | Fetched with every tile build, not committed                                                                                  |
| Roadwork   | The City's traffic map, Québec 511 (`ottawa`, `quebec511`) | Read live by the browser                                                                                                      |
| Elevation  | NRCan MRDEM-30 over SRTM, for the router                   | Read when the router is built                                                                                                 |

## Ottawa in shared code

A few things outside this folder still follow Ottawa's data:

- the collision details in `web/src/i18n.ts` are keyed by the values in the city's data;
- the collision and theft years are constants in `web/src/collisions.ts` and `web/src/thefts.ts`;
- the ward colours in `web/src/layers.ts` are keyed `ottawa` and `gatineau`.

`oldPages` in `region.json` sends links to the old Bike Ottawa maps to the right map here.
