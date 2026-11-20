# Contributing

Three ways to help: fix the data, report a problem, or change the code.

## Fix the data

The map comes from [OpenStreetMap](https://www.openstreetmap.org), rebuilt every night. Fix a wrong surface or a missing bike lane in OSM, and it shows the next morning.

- **Edit in OSM** on a card opens the editor there. Yellow on the Pathways layer means not tagged yet.
- On a phone: [StreetComplete](https://streetcomplete.app/), [Every Door](https://every-door.app/).
- Local tagging: Bike Ottawa's [tagging guide](https://github.com/BikeOttawa/OSM-Bike-Ottawa-Tagging-Guide).
- Photos from [Mapillary](https://www.mapillary.com/mobile-apps) and [Fotoshi](https://fotoshi.com/) show on the cards.

Collisions, thefts, wards and projects come from the city and the police. Report mistakes there as issues.

## Report a problem

[Open an issue](https://github.com/BikeOttawa/bikeottawa-maps/issues/new) with the link from the address bar: it keeps the layer, filters, position and route. Add a screenshot, and the browser and device if something looks broken.

## Change the code

### Set up

Node 24, Docker for the router, and on a Mac:

```sh
brew install osmium-tool tippecanoe pmtiles
pipx install osmium   # pyosmium-up-to-date
npm install
npm run basemap       # once
npm run tiles         # first run downloads 2.2 GB of OSM extracts
npm run dev
```

For the route planner, run the [local router](docs/development.md#the-router). For photos, put a Mapillary token in `web/.env.development.local`. For editing from cards, add the redirect URI `http://127.0.0.1:5173/land.html` to the site's OAuth 2 app on openstreetmap.org (or register your own), put its client ID there as `VITE_OSM_CLIENT_ID`, run `npm run dev -- --host 127.0.0.1` and open http://127.0.0.1:5173: OSM takes plain `http` only for 127.0.0.1, not `localhost`. Edits go to the real map. More in [development.md](docs/development.md).

### Make the change

1. Fork, branch, change.
2. Run the checks CI runs:

   ```sh
   npm run format && npm run lint && npm run typecheck && npm test
   ```

3. Open a pull request against `main`, with a screenshot for anything visible. It needs CI to pass and one approval.

A merge to `main` goes live within minutes. For bigger changes, open an issue first.

### House rules

More in [AGENTS.md](AGENTS.md).

- **English and French.** Every string is in `web/src/i18n.ts` in both, Quebec French, about as short as the English. OQLF typography: a non-breaking space before `:`, none before `;` `?` `!`.
- **No keys in code.** Tokens go in `.env` files and repository variables.
- **Gentle with outside services.** Photon: two requests at a time. OSM API: one feature at a time, only when a card needs it.
- **Router profiles fail whole.** An unknown tag value stops the profile loading; try changes on a second router container.
- **Tests next to the code.** `*.test.mjs` (pipeline, `node --test`), `*.test.ts` (app, Vitest).
- **Short, plain comments and docs.**

## Licence

Contributions are under the [MIT licence](LICENSE), like the code. Data licences: see the [README](README.md#licence).
