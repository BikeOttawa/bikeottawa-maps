# Regions

One folder per city or area the maps can be built for. `MAP_REGION` picks one: in the environment, in a `.env` file at the top of the repository, or as a repository variable when deployed. Without it, `ottawa`.

The tiles, the router and the site all read the same choice (`regions/region.mjs`). After changing it, build the tiles and the router again.

| File                                                                      | Purpose                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `region.json`                                                             | The fields below                                                               |
| `brand/logo.png`                                                          | The logo beside the title, shown 28 px high                                    |
| `brand/favicon.svg`, `brand/apple-touch-icon.png`                         | The browser tab's icon, and the one iPhones use (180 px)                       |
| `brand/icon-192.png`, `brand/icon-512.png`, `brand/icon-maskable-512.png` | The installed app's icons                                                      |
| `profiles/*.brf`                                                          | The router's BRouter profiles: one to ride, one to walk                        |
| `pipeline/`                                                               | Optional. The scripts that fetch the city's own data, and their tests          |
| `data/*.geojson`                                                          | Optional. The data those scripts write that is committed, served under `data/` |

| `region.json` field          | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `shortTitle`        | The site's name, in English and French, and the short one under the installed app's icon                                                    |
| `description`                | One line about the site, for search engines and the installed app                                                                           |
| `name`                       | The area's name                                                                                                                             |
| `bbox`, `center`             | The area the map covers and searches, and where it opens                                                                                    |
| `timeZone`                   | Opening hours are read in this time                                                                                                         |
| `routingBbox`                | The wider area routes may pass through                                                                                                      |
| `extracts`, `replicationUrl` | The OSM extracts the area is cut from (each with its boundary), and where its updates come from                                             |
| `profiles`                   | The names of the profiles to ride and to walk, as in `profiles/`                                                                            |
| `cityData`                   | Optional. The city's own data the site shows: any of the layers `collisions`, `thefts`, `construction` and the overlays `wards`, `roadwork` |
| `elevation`                  | Optional. A finer elevation raster (a GeoTIFF's address) laid over SRTM for the router                                                      |
| `org`                        | Optional. The group behind the site: `name` and `url` for the footer, and `join`, `volunteer`, `donate` for the help card                   |
| `repo`                       | The code's repository: the footer's link, and where ideas are sent                                                                          |
| `osm`                        | `createdBy` and `hashtag`, written on edits and notes sent to OpenStreetMap                                                                 |
| `oldPages`                   | Optional. Paths of a site this one replaces, each with the map it opens here                                                                |

A profile can only use the tags in BRouter's lookups and `routing/lookups-extra*.dat`. The site passes the bike profile the weights in `web/src/route/styles.ts`, and the walk profile `winter`.

## The city's own data

The site reads each kind in one format, whatever the city. A region that has a kind names it in `cityData` and writes it with a script of its own, run by the npm script of the same name:

| Kind           | Script                                     | Writes                                                            |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `collisions`   | `pipeline/fetch-collisions.mjs`            | `data/collisions.geojson`, committed                              |
| `thefts`       | `pipeline/fetch-thefts.mjs`                | `data/thefts.geojson`, committed                                  |
| `wards`        | `pipeline/fetch-wards.mjs`                 | `data/wards.geojson`, committed                                   |
| `construction` | `pipeline/fetch-construction.mjs <folder>` | `construction.geojson` in the tiles folder, with every tile build |

Ottawa's scripts show the fields each file holds. `roadwork` has no script: the site reads Ottawa's and Quebec's services live (`web/src/construction.ts`), so it fits no other city yet. The wording of these layers in `web/src/i18n.ts` still names Ottawa's sources.
