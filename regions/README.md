# Regions

One folder per city or area the maps can be built for. `MAP_REGION` picks one: in the environment, in a `.env` file at the top of the repository, or as a repository variable when deployed. Without it, `ottawa`.

- [ottawa](ottawa/README.md): the live site, with all the city's own data.
- [montreal](montreal/README.md): a generic example with OSM data only, to copy for a new city.

The tiles, the router and the site all read the same choice (`regions/region.mjs`). After changing it, build the tiles and the router again. Each region keeps its own OSM data (`.cache/osm/<region>.osm.pbf`), so switching back only brings it up to date.

| File                                                                      | Purpose                                                                        |
| ------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `region.json`                                                             | The fields below                                                               |
| `brand/logo.png`                                                          | The logo beside the title, shown 28 px high                                    |
| `brand/favicon.svg`, `brand/apple-touch-icon.png`                         | The browser tab's icon, and the one iPhones use (180 px)                       |
| `brand/icon-192.png`, `brand/icon-512.png`, `brand/icon-maskable-512.png` | The installed app's icons                                                      |
| `profiles/*.brf`                                                          | The router's BRouter profiles: one to ride, one to walk                        |
| `pipeline/`                                                               | Optional. The scripts that fetch the city's own data, and their tests          |
| `data/*.geojson`                                                          | Optional. The data those scripts write that is committed, served under `data/` |

| `region.json` field          | Purpose                                                                                                                                                                     |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`, `shortTitle`        | The site's name, in English and French, and the short one under the installed app's icon                                                                                    |
| `description`                | One line about the site, in English and French, for search engines and link previews; the installed app shows the English one                                               |
| `name`                       | The area's name                                                                                                                                                             |
| `bbox`, `center`             | The area the map covers and searches, and where it opens                                                                                                                    |
| `accent`                     | Optional. The site's colour, for buttons, links and the browser's bar, as `#rrggbb`; teal if not set. White text sits on it, so it must be dark enough                      |
| `timeZone`                   | Opening hours are read in this time                                                                                                                                         |
| `routingBbox`                | The wider area routes may pass through                                                                                                                                      |
| `extracts`, `replicationUrl` | The OSM extracts the area is cut from (each with its boundary), and where its updates come from                                                                             |
| `profiles`                   | The names of the profiles to ride and to walk, as in `profiles/`                                                                                                            |
| `cityData`                   | Optional. The city's own data the site shows, by kind: the layers `collisions`, `thefts`, `construction` and the overlay `wards`, each with its credits and wording (below) |
| `roadwork`                   | Optional. The roadwork sources the site reads today's closures from (below)                                                                                                 |
| `elevation`                  | Optional. A finer elevation raster laid over SRTM for the router: `url`, a GeoTIFF's address, and `credit`, whose it is (`name`, `url`)                                     |
| `org`                        | Optional. The group behind the site: `name` and `url` for the footer, and `join`, `volunteer`, `donate` for the help card                                                   |
| `repo`                       | The code's repository, for the footer's link                                                                                                                                |
| `ideas`                      | Optional. Where "Suggest an idea" in the help card goes: a form or a page that takes ideas. The repository's issues if not set                                              |
| `osm`                        | `createdBy` and `hashtag`, written on edits and notes sent to OpenStreetMap                                                                                                 |
| `oldPages`                   | Optional. Paths of a site this one replaces, each with the map it opens here                                                                                                |

A profile can only use the tags in BRouter's lookups and `routing/lookups-extra*.dat`. The site passes the bike profile the weights in `web/src/route/styles.ts`, and the walk profile `winter`.

## The city's own data

The site reads each kind in one format, whatever the city. A region that has a kind names it in `cityData` and writes it with a script of its own, run by the npm script of the same name:

| Kind           | Script                                     | Writes                                                            |
| -------------- | ------------------------------------------ | ----------------------------------------------------------------- |
| `collisions`   | `pipeline/fetch-collisions.mjs`            | `data/collisions.geojson`, committed                              |
| `thefts`       | `pipeline/fetch-thefts.mjs`                | `data/thefts.geojson`, committed                                  |
| `wards`        | `pipeline/fetch-wards.mjs`                 | `data/wards.geojson`, committed                                   |
| `construction` | `pipeline/fetch-construction.mjs <folder>` | `construction.geojson` in the tiles folder, with every tile build |

Ottawa's scripts show the fields each file holds.

Each kind in `cityData` says whose data it is, in the region's own words. The site's shared text names no city:

| Field     | Holds                                                                                        |
| --------- | -------------------------------------------------------------------------------------------- |
| `credits` | Who to credit on the map while it shows: a list of `name` and `url`                          |
| `source`  | For a layer, the source as its legend names it, in `en` and `fr`: "City of Ottawa open data" |
| `note`    | Optional. A sentence more about the data, in `en` and `fr`, shown after the source           |

## Roadwork

Today's closures are read live by the browser, so they have no script. Each service has a source in `web/src/roadwork/sources/`, and a region lists the ones it uses by file name: `"roadwork": ["ottawa", "quebec511"]`. Sources are shared, because one service often covers many cities: `quebec511` is right for any region in Quebec.

| Source      | Reads                                                       |
| ----------- | ----------------------------------------------------------- |
| `ottawa`    | The City of Ottawa's traffic map                            |
| `quebec511` | Québec 511: roadwork on the province's roads, within `bbox` |

To add one, write `web/src/roadwork/sources/<name>.ts`. Its `credit` export names whose data it is, with a link, for the map's credits; its `label` export says what it reads, in `en` and `fr`, for the overlay's hint. Its default export gets the region's `bbox`, the language and an abort signal, and returns closures in the one shape the site reads (`Closure` in `web/src/roadwork/closures.ts`): a place, a headline, and where the service has them a stretch, dates, lanes, a detour, who reported it and a page. Then:

- keep its wording in its file, in both languages, as the two do: `web/src/i18n.ts` names no service;
- check that the service lets any website read it (CORS), and ask it for the box only where it can be;
- add a test of its parsing next to it, as the two have in `web/src/roadwork/closures.test.ts`.

A name with no file fails the build.
