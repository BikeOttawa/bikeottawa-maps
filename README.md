# Bike Ottawa Maps

Cycling maps for Ottawa–Gatineau, built on OpenStreetMap by [Bike Ottawa](https://bikeottawa.ca) volunteers.

**[Open the map](https://maps.bikeottawa.ca)** · English and French · installs as an app on your phone or desktop

## Features

- **Places** for cyclists: parking, repairs, air, water, toilets, cafés
- **Pathways** by surface, width, snow clearing, smoothness and lighting
- **Comfort**: streets by level of traffic stress
- **Collisions** (City of Ottawa) and **bike thefts** (Ottawa Police)
- **Projects**: the City's construction forecast
- **Overlays**: bike lanes, bike routes, wards, roadwork, street lights
- **Route planner** by bike or on foot
- **How far** you get by bike or foot in 5 to 30 minutes

## For your city

The maps can be built for any area OpenStreetMap covers. Everything about a city lives in one folder under `regions/`: its area, names, logo, colour and router profiles, and its own data where it has some.

- [Montréal](regions/montreal/README.md) is the example to copy: OSM data only, with Places, Pathways, Comfort and the route planner.
- [Ottawa](regions/ottawa/README.md) adds the city's own collisions, thefts, construction projects and wards.

## Docs

- [How the map works](docs/how-it-works.md)
- [Development](docs/development.md)
- [Deployment](docs/deployment.md)
- [Contributing](CONTRIBUTING.md)
- [Another city](regions/README.md): what a region holds

## Licence

Code: [MIT](LICENSE). Data keeps its own licence:

- OpenStreetMap: [ODbL](https://www.openstreetmap.org/copyright)
- City of Ottawa (collisions, projects, wards): Open Government Licence – Ottawa
- Ottawa Police (thefts): Open Government Licence – Ottawa Police Service
- Ville de Gatineau (districts) and Québec 511 (roadwork): CC BY 4.0
- NRCan MRDEM-30 (elevation): Open Government Licence – Canada
