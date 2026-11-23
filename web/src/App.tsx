import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type CollisionFilters,
  collisionSpots,
  formatCollisionFilters,
  parseCollisionFilters,
  spotsGeoJSON,
} from './collisions'
import { type ComfortFilters, type ComfortTotals, formatComfortFilters, parseComfortFilters } from './comfort'
import { BarrierCard, barrierLabel } from './components/BarrierCard'
import { BikeRouteCard } from './components/BikeRouteCard'
import { CollisionCard } from './components/CollisionCard'
import { ConstructionCard } from './components/ConstructionCard'
import { FeatureCard } from './components/FeatureCard'
import { HowToHelp } from './components/HowToHelp'
import { LayerPicker } from './components/LayerPicker'
import { Legend } from './components/Legend'
import { type Mode, ModeSwitch } from './components/ModeSwitch'
import { PlaceInput } from './components/PlaceInput'
import { ReachForm } from './components/ReachForm'
import { formatArea, ReachResult } from './components/ReachResult'
import { RouteForm, RouteSummary } from './components/RouteForm'
import { RouteResult } from './components/RouteResult'
import { LayerPeek, ReachPeek, RoutePeek } from './components/SheetPeek'
import { TheftCard } from './components/TheftCard'
import { ASSETS_BASE, ROUTER_URL } from './config'
import {
  type ConstructionFilters,
  closureSummary,
  closuresGeoJSON,
  formatConstructionFilters,
  parseConstructionFilters,
} from './construction'
import { osmViewUrl, parseHash, withHashParam } from './hash'
import { initialLang, type Lang, LangContext, rememberLang, translator } from './i18n'
import { type BasemapId, isBasemapId, isLayerId, type LayerId } from './layers'
import { MapView } from './map/MapView'
import type { Selected, StyleState } from './map/style'
import { formatPathwayFilters, type PathwayFilters, type PathwayTotals, parsePathwayFilters } from './pathways'
import { usePlacePoints } from './placePoints'
import { isPlaceKind, PLACE_KINDS, type PlaceKind } from './places'
import { hasCityData, REGION } from './region'
import type { RouteView } from './route/breakdown'
import type { LngLat, RouteHighlight, RouteStop } from './route/brouter'
import { type Place, reverseLabel } from './route/geocode'
import { locate } from './route/locate'
import { DEFAULT_REACH_MINUTES, isReachMinutes, type ReachMinutes, type ReachView, reachCover } from './route/reach'
import { reachArea } from './route/reachArea'
import { useReachPlaces } from './route/reachPlaces'
import { roadworkOnRoute } from './route/roadwork'
import {
  formatParams,
  formatPoints,
  formatVias,
  parseParams,
  parsePoints,
  parseVias,
  type RoutePoint,
  type RoutePoints,
} from './route/state'
import {
  DEFAULT_STYLE,
  isStyleId,
  isTravel,
  isWalkStyleId,
  type ParamKey,
  PRESETS,
  paramsFor,
  profileFor,
  type RouteParams,
  type StyleId,
  type Travel,
  type WalkStyleId,
} from './route/styles'
import { useReach, visibleReach } from './route/useReach'
import { useRoute, visibleRoutes } from './route/useRoute'
import { formatTheftFilters, parseTheftFilters, type TheftFilters, theftSpots, theftSpotsGeoJSON } from './thefts'
import { useClosures } from './useClosures'
import { useCollisionData, useTheftData } from './usePoints'
import { useProjects } from './useProjects'

const DEFAULT_LAYER: LayerId = 'places'
const PHONE_LAYOUT = '(max-width: 720px)'
const ignore = () => {}

/** Hash entries that belong to the Explore mode: a link with one opens there. */
const EXPLORE_KEYS = ['layer', 'places', 'collisions', 'thefts', 'construction', 'comfort', 'pathways']

/** The link's mode. Without one, phones open the route planner, unless the link shows a layer. */
function readMode(hash: Record<string, string>): Mode {
  if (hash.mode === 'explore' || hash.mode === 'route' || hash.mode === 'reach') return hash.mode
  const phone = window.matchMedia(PHONE_LAYOUT).matches
  return phone && !EXPLORE_KEYS.some((key) => key in hash) ? 'route' : 'explore'
}

function followMap(event: { currentTarget: HTMLAnchorElement }) {
  event.currentTarget.href = osmViewUrl(window.location.hash)
}

/** Everything the URL hash carries besides the map position. */
interface UrlState {
  layer: LayerId
  /** Place kinds switched on in the Places layer; none to start with. */
  placeKinds: readonly PlaceKind[]
  /** Which collisions the collisions layer shows. */
  collisions: CollisionFilters
  /** What the construction layer shows. */
  construction: ConstructionFilters
  /** Which ways the comfort layer shows. */
  comfortPicks: ComfortFilters
  /** Which bike thefts the thefts layer shows. */
  thefts: TheftFilters
  /** Which pathways the pathways layer shows. */
  pathways: PathwayFilters
  mode: Mode
  points: RoutePoints
  /** Places the route must pass through, in riding order. */
  vias: readonly LngLat[]
  /** Riding or walking, for routes and how far you get. */
  travel: Travel
  style: StyleId
  custom: RouteParams
  walkStyle: WalkStyleId
  /** Riding time shown in the How far mode. */
  minutes: ReachMinutes
  /** Which of a trip's routes is chosen: the router's best (0) or one of its alternatives. */
  alt: number
}

function readUrl(): UrlState {
  const hash = parseHash(window.location.hash)
  // Links to the winter layer open the pathways coloured by snow clearing, which replaced it.
  const winter = hash.layer === 'winter'
  return {
    layer: winter ? 'pathways' : isLayerId(hash.layer) ? hash.layer : DEFAULT_LAYER,
    placeKinds: (hash.places ?? '').split(',').filter(isPlaceKind),
    collisions: parseCollisionFilters(hash.collisions),
    thefts: parseTheftFilters(hash.thefts),
    construction: parseConstructionFilters(hash.construction),
    comfortPicks: parseComfortFilters(hash.comfort),
    pathways: winter ? { ...parsePathwayFilters(hash.pathways), by: 'snow' } : parsePathwayFilters(hash.pathways),
    mode: readMode(hash),
    points: parsePoints(hash.route),
    vias: parseVias(hash.via),
    travel: isTravel(hash.travel) ? hash.travel : 'bike',
    style: isStyleId(hash.style) ? hash.style : DEFAULT_STYLE,
    custom: parseParams(hash.custom, PRESETS.balanced),
    walkStyle: isWalkStyleId(hash.walk) ? hash.walk : 'normal',
    minutes: isReachMinutes(hash.minutes) ? (Number(hash.minutes) as ReachMinutes) : DEFAULT_REACH_MINUTES,
    alt: /^[12]$/.test(hash.alt ?? '') ? Number(hash.alt) : 0,
  }
}

function writeUrl(state: UrlState): void {
  const routing = state.mode === 'route'
  const reaching = state.mode === 'reach'
  const riding = routing || reaching
  const entries: [string, string | null][] = [
    ['layer', state.layer === DEFAULT_LAYER ? null : state.layer],
    ['places', state.placeKinds.length ? state.placeKinds.join(',') : null],
    ['collisions', state.layer === 'collisions' ? formatCollisionFilters(state.collisions) : null],
    ['thefts', state.layer === 'thefts' ? formatTheftFilters(state.thefts) : null],
    ['construction', state.layer === 'construction' ? formatConstructionFilters(state.construction) : null],
    ['comfort', state.layer === 'comfort' ? formatComfortFilters(state.comfortPicks) : null],
    ['pathways', state.layer === 'pathways' ? formatPathwayFilters(state.pathways) : null],
    // Phones keep Explore in the link too, so a reload stays there.
    ['mode', riding || window.matchMedia(PHONE_LAYOUT).matches ? state.mode : null],
    // How far starts from the route's start, so the two modes share it.
    ['route', routing ? formatPoints(state.points) : reaching ? formatPoints([state.points[0], null]) : null],
    ['via', routing ? formatVias(state.vias) : null],
    ['minutes', reaching && state.minutes !== DEFAULT_REACH_MINUTES ? String(state.minutes) : null],
    ['travel', riding && state.travel === 'foot' ? 'foot' : null],
    ['style', riding && state.travel === 'bike' && state.style !== DEFAULT_STYLE ? state.style : null],
    ['custom', riding && state.travel === 'bike' && state.style === 'custom' ? formatParams(state.custom) : null],
    ['walk', riding && state.travel === 'foot' && state.walkStyle !== 'normal' ? state.walkStyle : null],
    ['alt', routing && state.alt > 0 ? String(state.alt) : null],
  ]
  // MapLibre keeps its own `map=` entry in the hash; only ours are touched.
  const hash = entries.reduce((h, [key, value]) => withHashParam(h, key, value), window.location.hash)
  if (hash !== window.location.hash) {
    window.history.replaceState(null, '', hash || window.location.pathname + window.location.search)
  }
}

const BASEMAP_KEY = 'basemap'

/** The map style is a personal preference, so it is remembered per browser rather than put in links. */
function storedBasemap(key: string, fallback: BasemapId): BasemapId {
  try {
    const stored = localStorage.getItem(key)
    if (isBasemapId(stored)) return stored
  } catch {
    // Storage can be blocked; use the default.
  }
  return fallback
}

function rememberBasemap(key: string, basemap: BasemapId) {
  try {
    localStorage.setItem(key, basemap)
  } catch {
    // Not remembered when storage is blocked.
  }
}

const BIKE_LANES_KEY = 'bike-lanes'
const BIKE_ROUTES_KEY = 'bike-routes'
const WARDS_KEY = 'wards'
const ROADWORK_KEY = 'roadwork'
const LIGHTS_KEY = 'lights'
const REACH_VIEW_KEY = 'reach-view'

/** How far as the area covered or the streets reached: the area unless the streets were picked, remembered per browser. */
function storedReachView(): ReachView {
  try {
    return localStorage.getItem(REACH_VIEW_KEY) === 'streets' ? 'streets' : 'area'
  } catch {
    return 'area'
  }
}

function rememberReachView(view: ReachView) {
  try {
    if (view === 'streets') localStorage.setItem(REACH_VIEW_KEY, 'streets')
    else localStorage.removeItem(REACH_VIEW_KEY)
  } catch {
    // Not remembered when storage is blocked.
  }
}

/** The roadwork overlay, where the region has it: off unless turned on, remembered per browser. */
function storedRoadwork(): boolean {
  if (!hasCityData('roadwork')) return false
  try {
    return localStorage.getItem(ROADWORK_KEY) === 'on'
  } catch {
    return false
  }
}

function rememberRoadwork(on: boolean) {
  try {
    if (on) localStorage.setItem(ROADWORK_KEY, 'on')
    else localStorage.removeItem(ROADWORK_KEY)
  } catch {
    // Not remembered when storage is blocked.
  }
}

/**
 * The street lights overlay: off unless turned on, remembered per browser.
 * Links to the night layer it replaced turn it on.
 */
function storedLights(): boolean {
  if (parseHash(window.location.hash).layer === 'night') return true
  try {
    return localStorage.getItem(LIGHTS_KEY) === 'on'
  } catch {
    return false
  }
}

function rememberLights(on: boolean) {
  try {
    if (on) localStorage.setItem(LIGHTS_KEY, 'on')
    else localStorage.removeItem(LIGHTS_KEY)
  } catch {
    // Not remembered when storage is blocked.
  }
}

/** The wards overlay, where the region has it: off unless turned on, remembered per browser. */
function storedWards(): boolean {
  if (!hasCityData('wards')) return false
  try {
    return localStorage.getItem(WARDS_KEY) === 'on'
  } catch {
    return false
  }
}

function rememberWards(on: boolean) {
  try {
    if (on) localStorage.setItem(WARDS_KEY, 'on')
    else localStorage.removeItem(WARDS_KEY)
  } catch {
    // Not remembered when storage is blocked.
  }
}

/** The bike routes overlay: off unless turned on, remembered per browser. */
function storedBikeRoutes(): boolean {
  try {
    return localStorage.getItem(BIKE_ROUTES_KEY) === 'on'
  } catch {
    return false
  }
}

function rememberBikeRoutes(on: boolean) {
  try {
    if (on) localStorage.setItem(BIKE_ROUTES_KEY, 'on')
    else localStorage.removeItem(BIKE_ROUTES_KEY)
  } catch {
    // Not remembered when storage is blocked.
  }
}

/** The bike lanes overlay goes with the map style: on unless turned off, remembered per browser. */
function storedBikeLanes(): boolean {
  try {
    return localStorage.getItem(BIKE_LANES_KEY) !== 'off'
  } catch {
    return true
  }
}

function rememberBikeLanes(on: boolean) {
  try {
    if (on) localStorage.removeItem(BIKE_LANES_KEY)
    else localStorage.setItem(BIKE_LANES_KEY, 'off')
  } catch {
    // Not remembered when storage is blocked.
  }
}

/** Whether the phone layout is in effect, kept current as the window is resized or rotated. */
function usePhoneLayout(): boolean {
  const [phone, setPhone] = useState(() => window.matchMedia(PHONE_LAYOUT).matches)
  useEffect(() => {
    const query = window.matchMedia(PHONE_LAYOUT)
    const update = () => setPhone(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return phone
}

interface TileMeta {
  /** Date of the OpenStreetMap data in the tiles. */
  osmTimestamp?: string
  pathways?: PathwayTotals
  /** Km of the comfort layer by every combination of its filters' bands. */
  comfort?: ComfortTotals
}

/** What the pipeline says about the tiles it built. */
function useTileMeta(): TileMeta | null {
  const [meta, setMeta] = useState<TileMeta | null>(null)
  useEffect(() => {
    fetch(`${ASSETS_BASE}/tiles/meta.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setMeta)
      .catch(() => setMeta(null))
  }, [])
  return meta
}

function formatDataDate(timestamp: string | undefined, lang: Lang): string | null {
  if (!timestamp) return null
  return new Date(timestamp).toLocaleDateString(lang === 'fr' ? 'fr-CA' : 'en-CA', { dateStyle: 'medium' })
}

/** Looks up the address of a point that has no name yet (picked on the map, dragged, or from a link). */
function useAddressLabel(
  point: RoutePoint | null,
  lang: Lang,
  enabled: boolean,
  onLabel: (lngLat: LngLat, label: string) => void,
): void {
  const pending = enabled && point && !point.label ? point.lngLat : null
  const [lon, lat] = pending ?? [null, null]
  useEffect(() => {
    if (lon === null || lat === null) return
    const controller = new AbortController()
    reverseLabel([lon, lat], lang, controller.signal)
      .then((label) => label && onLabel([lon, lat], label))
      // No address is not an error worth showing; the field keeps its coordinates.
      .catch(() => {})
    return () => controller.abort()
  }, [lon, lat, lang, onLabel])
}

const viaKey = ([lon, lat]: LngLat) => `${lon},${lat}`

/**
 * Addresses of the via points, looked up as they are placed or moved, keyed by
 * position. Empty where none was found, so it is not asked for again.
 */
function useViaLabels(
  vias: readonly LngLat[],
  lang: Lang,
  enabled: boolean,
): [Record<string, string>, (lngLat: LngLat, label: string) => void] {
  const [labels, setLabels] = useState<Record<string, string>>({})
  const missing = enabled
    ? vias
        .map(viaKey)
        .filter((key) => !(key in labels))
        .join(';')
    : ''
  useEffect(() => {
    if (!missing) return
    const controller = new AbortController()
    for (const key of missing.split(';')) {
      const [lon, lat] = key.split(',').map(Number)
      reverseLabel([lon, lat], lang, controller.signal)
        .then((label) => setLabels((current) => ({ ...current, [key]: label ?? '' })))
        // Without an address the field shows the coordinates.
        .catch(() => {})
    }
    return () => controller.abort()
  }, [missing, lang])
  const remember = useCallback(
    (lngLat: LngLat, label: string) => setLabels((current) => ({ ...current, [viaKey(lngLat)]: label })),
    [],
  )
  return [labels, remember]
}

export function App() {
  const [lang, setLang] = useState<Lang>(initialLang)
  const [url, setUrl] = useState<UrlState>(readUrl)
  const [basemap, setBasemap] = useState<BasemapId>(() => storedBasemap(BASEMAP_KEY, 'light'))
  const [bikeLanes, setBikeLanes] = useState(storedBikeLanes)
  // The pathways layer draws the paths itself: there the bike lanes start off, each time it is picked.
  const [pathwayBikeLanes, setPathwayBikeLanes] = useState(false)
  const [bikeRoutes, setBikeRoutes] = useState(storedBikeRoutes)
  const [wards, setWards] = useState(storedWards)
  const [roadwork, setRoadwork] = useState(storedRoadwork)
  const [lights, setLights] = useState(storedLights)
  const [reachView, setReachView] = useState(storedReachView)
  // The route card's open row, none at first: the route is coloured by it, or by comfort.
  const [routeView, setRouteView] = useState<RouteView | null>(null)
  const routeColoured = routeView ?? 'comfort'
  const [selected, setSelected] = useState<Selected | null>(null)
  // A place picked from the search while exploring.
  const [found, setFound] = useState<Place | null>(null)
  // Metres along the route under the pointer, shared by the map and the elevation chart.
  const [routeHover, setRouteHover] = useState<number | null>(null)
  // Legend item picked out on the route: pointed at for now, or pinned by a click.
  const [pointedPart, setPointedPart] = useState<RouteHighlight | null>(null)
  const [pinnedPart, setPinnedPart] = useState<RouteHighlight | null>(null)
  const sheet = useRef<HTMLDivElement>(null)
  const topbar = useRef<HTMLDivElement>(null)
  // On phones the bottom sheet starts folded away so the map gets the screen.
  const phone = usePhoneLayout()
  const [sheetOpen, setSheetOpen] = useState(() => !window.matchMedia(PHONE_LAYOUT).matches)
  const [topOpen, setTopOpen] = useState(true)
  const i18n = useMemo(() => ({ lang, t: translator(lang) }), [lang])
  const { t } = i18n
  const tileMeta = useTileMeta()
  const dataDate = formatDataDate(tileMeta?.osmTimestamp, lang)
  const {
    layer,
    placeKinds,
    collisions,
    thefts,
    construction,
    comfortPicks,
    pathways,
    mode,
    points,
    vias,
    travel,
    style,
    custom,
    walkStyle,
    minutes,
  } = url
  const profile = useMemo(() => profileFor(travel, style, custom, walkStyle), [travel, style, custom, walkStyle])
  // Not exploring: planning a route, or seeing how far you get.
  const routing = mode !== 'explore'
  // Both need a router; without one their page only says so.
  const planning = mode === 'route' && ROUTER_URL !== null
  const reaching = mode === 'reach' && ROUTER_URL !== null
  // On phones the panel folds once both ends are set, to leave the route the screen.
  // Only new ends fold it: changing the style keeps it open.
  const ends = JSON.stringify([points[0]?.lngLat, points[1]?.lngLat, vias])
  const bothEnds = planning && points[0] !== null && points[1] !== null
  // biome-ignore lint/correctness/useExhaustiveDependencies: only new ends fold it
  useEffect(() => {
    if (phone && bothEnds) setTopOpen(false)
  }, [ends])
  const routeHighlight = planning ? (pointedPart ?? pinnedPart) : null
  // A route's stops crowd a phone's screen: there they wait for the map button.
  const [routeStops, setRouteStops] = useState(() => !window.matchMedia(PHONE_LAYOUT).matches)
  const routeState = useRoute(ROUTER_URL, points, vias, profile, planning)
  // Roadwork: the closures, fetched live while the overlay is on or a bike route is planned.
  const closures = useClosures(hasCityData('roadwork') && (roadwork || (planning && travel === 'bike')), lang)
  const plannedRoutes = planning ? visibleRoutes(routeState) : []
  // The route chosen holds for the trip it was chosen on: new points or another style start from the best.
  const trip = JSON.stringify([points.map((p) => p?.lngLat), vias, profile])
  const [altTrip, setAltTrip] = useState(trip)
  const alt = altTrip === trip ? url.alt : 0
  const choice = plannedRoutes[alt] ? alt : 0
  const plannedRoute = plannedRoutes[choice] ?? null
  const chooseRoute = useCallback(
    (index: number) => {
      setAltTrip(trip)
      setUrl((current) => ({ ...current, alt: index }))
    },
    [trip],
  )
  // A bike route counts the roadwork on it with its stops, once the closures are in; its
  // barriers are named, for their bubbles on the map.
  const route = useMemo(() => {
    if (!plannedRoute || travel !== 'bike') return plannedRoute
    const t = translator(lang)
    const byId = new Map((closures ?? []).map((closure) => [closure.id, closure]))
    const stops = [...plannedRoute.stops, ...(closures ? roadworkOnRoute(plannedRoute, closures) : [])]
    const label = (stop: RouteStop) => {
      const closure = stop.closure && byId.get(stop.closure)
      return closure ? closureSummary(closure, lang) : stop.barrier ? t(barrierLabel(stop.barrier)) : undefined
    }
    return { ...plannedRoute, stops: stops.map((stop) => ({ ...stop, label: label(stop) })) }
  }, [plannedRoute, closures, travel, lang])
  const reachState = useReach(ROUTER_URL, points[0]?.lngLat ?? null, minutes, profile, reaching)
  const reach = reaching ? visibleReach(reachState) : null
  const cover = useMemo(() => (reach ? reachCover(reach) : null), [reach])
  const area = cover?.area ?? 0
  const reachStart = points[0]?.lngLat
  const reachShape = useMemo(
    () => (reach && reachView === 'area' ? reachArea(reach, minutes, reachStart) : reach),
    [reach, reachView, minutes, reachStart],
  )
  // The places picked on the Places layer, counted within reach in the layer's order.
  // The places picked, for the map to merge when zoomed out.
  const placePoints = usePlacePoints(placeKinds, layer === 'places')
  const pickedKinds = useMemo(() => PLACE_KINDS.filter((kind) => placeKinds.includes(kind)), [placeKinds])
  const reachPlaces = useReachPlaces(reaching ? cover : null, pickedKinds)
  // A kind in that list picked out on the map: pointed at, or kept by a click.
  const [pointedKind, setPointedKind] = useState<PlaceKind | null>(null)
  const [pinnedKind, setPinnedKind] = useState<PlaceKind | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new count starts with nothing picked out
  useEffect(() => {
    setPointedKind(null)
    setPinnedKind(null)
  }, [reachPlaces])
  const placesOf = (kind: PlaceKind | null) => reachPlaces?.find((count) => count.kind === kind)?.points ?? null
  const highlightKind = pointedKind ?? pinnedKind
  const highlightPoints = placesOf(highlightKind)
  const placeHighlight = useMemo(
    () => (highlightKind && highlightPoints ? { kind: highlightKind, points: highlightPoints } : null),
    [highlightKind, highlightPoints],
  )

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = REGION.title[lang]
    rememberLang(lang)
  }, [lang])

  useEffect(() => writeUrl({ ...url, alt }), [url, alt])

  useEffect(() => rememberBasemap(BASEMAP_KEY, basemap), [basemap])
  useEffect(() => rememberBikeLanes(bikeLanes), [bikeLanes])
  useEffect(() => {
    if (layer !== 'pathways') setPathwayBikeLanes(false)
  }, [layer])
  useEffect(() => rememberBikeRoutes(bikeRoutes), [bikeRoutes])
  useEffect(() => rememberWards(wards), [wards])
  useEffect(() => rememberRoadwork(roadwork), [roadwork])
  useEffect(() => rememberLights(lights), [lights])
  useEffect(() => rememberReachView(reachView), [reachView])

  // Back/forward and pasted links change the hash without going through React.
  useEffect(() => {
    const onHashChange = () => {
      setUrl(readUrl())
      setSelected(null)
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  // Lets the map's own controls sit clear of the top bar and the bottom sheet on phones.
  useEffect(() => {
    const track = (element: HTMLElement | null, name: string) => {
      if (!element) return () => {}
      const observer = new ResizeObserver(([entry]) => {
        document.documentElement.style.setProperty(name, `${entry.target.getBoundingClientRect().height}px`)
      })
      observer.observe(element)
      return () => observer.disconnect()
    }
    const stopSheet = track(sheet.current, '--sheet-height')
    const stopTopbar = track(topbar.current, '--topbar-height')
    return () => {
      stopSheet()
      stopTopbar()
    }
  }, [])

  // Details of something just tapped should not stay folded away.
  useEffect(() => {
    if (selected) setSheetOpen(true)
  }, [selected])

  // Turning the routes off lets go of a route picked on them.
  const changeBikeRoutes = useCallback((on: boolean) => {
    setBikeRoutes(on)
    if (!on) setSelected((current) => (current?.kind === 'route' ? null : current))
  }, [])

  const update = useCallback((patch: Partial<UrlState>) => setUrl((current) => ({ ...current, ...patch })), [])

  const changeLayer = useCallback(
    (next: LayerId) => {
      update({ layer: next })
      setSelected(null)
    },
    [update],
  )

  const changeMode = useCallback((next: Mode) => {
    // From How far to a route, the start stays and the end is left to pick.
    setUrl((current) => ({
      ...current,
      mode: next,
      ...(current.mode === 'reach' && next === 'route' && { points: [current.points[0], null], vias: [] }),
    }))
    setSelected(null)
    setTopOpen(true)
  }, [])

  // A place picked from the search opens its card; the map finds out more if it is one of its own places.
  const findPlace = useCallback(
    (place: Place | null) => {
      setFound(place)
      if (place) {
        const name = place.name ?? place.address ?? place.label
        const address = place.name ? place.address : undefined
        const props = { name, ...(address && { address }) }
        setSelected({ kind: 'place', osm: place.osm ?? '', props, at: place.lngLat, searched: true })
      } else {
        // Clearing the search closes its card, not one opened since.
        setSelected((current) => (current?.kind === 'place' && found && current.at === found.lngLat ? null : current))
      }
    },
    [found],
  )

  const changeCollisions = useCallback(
    (next: CollisionFilters) => {
      update({ collisions: next })
      setSelected(null)
    },
    [update],
  )

  // The card stays open: the street is still there, picked or not.
  const changeComfort = useCallback((next: ComfortFilters) => update({ comfortPicks: next }), [update])

  const changeConstruction = useCallback(
    (next: ConstructionFilters) => {
      update({ construction: next })
      setSelected(null)
    },
    [update],
  )

  const changeThefts = useCallback(
    (next: TheftFilters) => {
      update({ thefts: next })
      setSelected(null)
    },
    [update],
  )

  // The card stays open: a mapper looks at a path one way, then the other.
  const changePathways = useCallback((next: PathwayFilters) => update({ pathways: next }), [update])

  const changePlaceKinds = useCallback((placeKinds: readonly PlaceKind[]) => {
    setUrl((current) => ({ ...current, placeKinds }))
    setSelected(null)
  }, [])

  const setPoint = useCallback((index: 0 | 1, point: RoutePoint | null) => {
    setUrl((current) => {
      const next: RoutePoints = [...current.points]
      next[index] = point
      // Via points only make sense between a start and an end.
      return { ...current, points: next, vias: point ? current.vias : [] }
    })
  }, [])

  const editVias = useCallback((edit: (vias: LngLat[]) => void) => {
    setUrl((current) => {
      const next = [...current.vias]
      edit(next)
      return { ...current, vias: next }
    })
  }, [])
  const addVia = useCallback((index: number, lngLat: LngLat) => editVias((v) => v.splice(index, 0, lngLat)), [editVias])
  const moveVia = useCallback(
    (index: number, lngLat: LngLat) => editVias((v) => v.splice(index, 1, lngLat)),
    [editVias],
  )
  const removeVia = useCallback((index: number) => editVias((v) => v.splice(index, 1)), [editVias])
  const [viaLabels, rememberViaLabel] = useViaLabels(vias, lang, planning)
  const viaPoints = useMemo(
    () => vias.map((lngLat): RoutePoint => ({ lngLat, label: viaLabels[viaKey(lngLat)] || undefined })),
    [vias, viaLabels],
  )
  // A via field cleared removes that point; a place picked from search moves it there.
  const changeVia = useCallback(
    (index: number, point: RoutePoint | null) => {
      if (!point) return removeVia(index)
      if (point.label) rememberViaLabel(point.lngLat, point.label)
      moveVia(index, point.lngLat)
    },
    [removeVia, moveVia, rememberViaLabel],
  )

  // A click on the map fills the first point that is still missing.
  const placePoint = useCallback((lngLat: LngLat) => {
    setUrl((current) => {
      const index = current.points.indexOf(null)
      if (index === -1) return current
      const next: RoutePoints = [...current.points]
      next[index] = { lngLat }
      return { ...current, points: next }
    })
  }, [])

  // Names a point once its address arrives, unless it has moved on in the meantime.
  const labelPoint = useCallback((index: 0 | 1, lngLat: LngLat, label: string) => {
    setUrl((current) => {
      const point = current.points[index]
      if (!point || point.label || point.lngLat[0] !== lngLat[0] || point.lngLat[1] !== lngLat[1]) return current
      const next: RoutePoints = [...current.points]
      next[index] = { ...point, label }
      return { ...current, points: next }
    })
  }, [])
  const labelStart = useCallback((lngLat: LngLat, label: string) => labelPoint(0, lngLat, label), [labelPoint])
  const labelEnd = useCallback((lngLat: LngLat, label: string) => labelPoint(1, lngLat, label), [labelPoint])
  useAddressLabel(points[0], lang, planning || reaching, labelStart)
  useAddressLabel(points[1], lang, planning, labelEnd)

  const movePoint = useCallback((index: 0 | 1, lngLat: LngLat) => setPoint(index, { lngLat }), [setPoint])
  // How far has only a start, and a click moves it.
  const placeStart = useCallback((lngLat: LngLat) => setPoint(0, { lngLat }), [setPoint])
  const setStart = useCallback((point: RoutePoint | null) => setPoint(0, point), [setPoint])
  // Where the device is, as the start, unless a start was set meanwhile.
  const locateStart = useCallback(() => {
    locate()
      .then((lngLat) =>
        setUrl((current) => {
          if (current.points[0]) return current
          return { ...current, points: [{ lngLat, label: t('myLocation') }, current.points[1]] }
        }),
      )
      // Without the location the start stays empty, for a click or a search.
      .catch(() => {})
  }, [t])

  // A route to a place picked on the map: from the start already set while
  // planning or on How far, else from where the device is.
  const routeHere = useCallback(
    (lngLat: LngLat, label: string) => {
      const start = mode === 'explore' ? null : points[0]
      update({ mode: 'route', points: [start, { lngLat, label }], vias: [] })
      setSelected(null)
      setTopOpen(true)
      if (!start) locateStart()
    },
    [mode, points, update, locateStart],
  )

  const changeMinutes = useCallback((next: ReachMinutes) => update({ minutes: next }), [update])

  const changeParam = useCallback((key: ParamKey, value: number) => {
    setUrl((current) => ({ ...current, custom: { ...current.custom, [key]: value } }))
  }, [])

  // Custom starts from whatever style was active, so the sliders show how that style is made.
  const changeStyle = useCallback((next: StyleId) => {
    setUrl((current) => ({
      ...current,
      style: next,
      custom: next === 'custom' && current.style !== 'custom' ? PRESETS[current.style] : current.custom,
    }))
  }, [])

  const picker = {
    travel,
    style,
    walkStyle,
    params: paramsFor(style, custom),
    onTravelChange: (next: Travel) => update({ travel: next }),
    onStyleChange: changeStyle,
    onWalkStyleChange: (next: WalkStyleId) => update({ walkStyle: next }),
    onParamChange: changeParam,
  }

  const reachStyle = useMemo(
    () => (reaching ? { minutes, area: reachView === 'area' } : null),
    [reaching, minutes, reachView],
  )
  const ownBikeLanes = layer === 'pathways' && !reachStyle
  const lanes = ownBikeLanes ? pathwayBikeLanes : bikeLanes
  // Collisions: loaded once the layer is first shown, grouped into spots by the filters.
  const collisionData = useCollisionData(layer === 'collisions')
  const allSpots = useMemo(
    () => (collisionData ? collisionSpots(collisionData, collisions) : null),
    [collisionData, collisions],
  )
  // The slider's top: the busiest spot under the other filters.
  const busiestSpot = useMemo(() => Math.max(1, ...(allSpots ?? []).map((s) => s.items.length)), [allSpots])
  const spots = useMemo(
    () => allSpots?.filter((s) => s.items.length >= collisions.minCount) ?? null,
    [allSpots, collisions.minCount],
  )
  const collisionsBy = collisions.by
  const collisionGeo = useMemo(
    () => (spots ? spotsGeoJSON(spots, collisionsBy, busiestSpot) : null),
    [spots, collisionsBy, busiestSpot],
  )
  const spotByKey = useMemo(() => new Map((spots ?? []).map((spot) => [spot.key, spot])), [spots])
  // Thefts, the same way: loaded with their layer, gathered at intersections.
  // Projects: the map fetches the file itself; the legend counts them.
  const projects = useProjects(layer === 'construction')
  const closureGeo = useMemo(() => (closures ? closuresGeoJSON(closures) : null), [closures])
  const theftData = useTheftData(layer === 'thefts')
  const allTheftSpots = useMemo(() => (theftData ? theftSpots(theftData, thefts) : null), [theftData, thefts])
  const busiestTheftSpot = useMemo(
    () => Math.max(1, ...(allTheftSpots ?? []).map((s) => s.items.length)),
    [allTheftSpots],
  )
  const shownTheftSpots = useMemo(
    () => allTheftSpots?.filter((s) => s.items.length >= thefts.minCount && s.value >= thefts.minValue) ?? null,
    [allTheftSpots, thefts.minCount, thefts.minValue],
  )
  const theftGeo = useMemo(
    () => (shownTheftSpots ? theftSpotsGeoJSON(shownTheftSpots, thefts.by, busiestTheftSpot) : null),
    [shownTheftSpots, thefts.by, busiestTheftSpot],
  )
  const theftSpotByKey = useMemo(
    () => new Map((shownTheftSpots ?? []).map((spot) => [spot.key, spot])),
    [shownTheftSpots],
  )

  // Looking closely at the chosen route: a row open, a part or stop picked out, a barrier or closure open.
  const routeClose =
    routeView !== null || routeHighlight !== null || selected?.kind === 'barrier' || selected?.kind === 'closure'
  const styleState = useMemo<StyleState>(
    () => ({
      lang,
      basemap,
      layer,
      placeKinds,
      placePoints,
      selected,
      route,
      routeOthers: plannedRoutes.flatMap((other, i) => (i === choice ? [] : [{ route: other, choice: i }])),
      routeOthersDim: routeClose,
      routeHighlight,
      routeStops,
      routeView: routeColoured,
      routeOnFoot: travel === 'foot',
      reach: reachStyle,
      collisions: layer === 'collisions' ? collisionGeo : null,
      collisionsBy,
      thefts: layer === 'thefts' ? theftGeo : null,
      theftsBy: thefts.by,
      construction,
      comfort: comfortPicks,
      roadwork,
      closures: roadwork ? closureGeo : null,
      pathways,
      bikeLanes: lanes,
      bikeRoutes,
      wards,
      lights,
      placeHighlight,
    }),
    [
      lang,
      basemap,
      layer,
      placeKinds,
      placePoints,
      selected,
      route,
      plannedRoutes,
      choice,
      routeClose,
      routeHighlight,
      routeStops,
      routeColoured,
      travel,
      reachStyle,
      collisionGeo,
      collisionsBy,
      theftGeo,
      thefts.by,
      construction,
      comfortPicks,
      roadwork,
      closureGeo,
      pathways,
      lanes,
      bikeRoutes,
      wards,
      lights,
      placeHighlight,
    ],
  )
  const mapRouting = useMemo(
    () =>
      planning
        ? {
            points,
            vias,
            onMapClick: placePoint,
            onMovePoint: movePoint,
            onAddVia: addVia,
            onMoveVia: moveVia,
            onRemoveVia: removeVia,
            hover: routeHover,
            onHover: setRouteHover,
            zoomTo: pinnedPart,
            busy: routeState.status === 'loading' ? (1 as const) : null,
            onChooseRoute: chooseRoute,
          }
        : reaching
          ? {
              points: [points[0], null] as RoutePoints,
              vias: [],
              onMapClick: placeStart,
              onMovePoint: movePoint,
              onAddVia: ignore,
              onMoveVia: ignore,
              onRemoveVia: ignore,
              hover: null,
              onHover: ignore,
              zoomTo: null,
              busy: reachState.status === 'loading' ? (0 as const) : null,
              onChooseRoute: ignore,
            }
          : null,
    [
      planning,
      reaching,
      reachState.status,
      routeState.status,
      points,
      vias,
      placePoint,
      placeStart,
      movePoint,
      addVia,
      moveVia,
      removeVia,
      routeHover,
      pinnedPart,
      chooseRoute,
    ],
  )

  // A spot pointed at on the old route means nothing on a new one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs when the route changes
  useEffect(() => {
    setRouteHover(null)
    setPointedPart(null)
    setPinnedPart(null)
    // A new route from the router, not the roadwork being added to the one shown.
  }, [plannedRoute])
  // The parts of one view are not the parts of another.
  const changeRouteView = useCallback((view: RouteView | null) => {
    setRouteView(view)
    setPointedPart(null)
    setPinnedPart(null)
  }, [])
  const hasResult = (planning && routeState.status !== 'idle') || (reaching && reachState.status !== 'idle')
  // What the folded sheet says it holds: a title, and under it a key or the
  // state of the route.
  const sheetTitle = route
    ? `${(route.distance / 1000).toFixed(1)} km · ${Math.max(1, Math.round(route.time / 60))} min · ↑ ${Math.round(route.ascent)} m`
    : routing
      ? reaching && points[0]
        ? `${t('mode.reach')} · ${minutes} min${reach ? ` · ${formatArea(area, lang)}` : ''}`
        : t(`mode.${mode}`)
      : t(`layer.${layer}`)
  const status = planning ? routeState.status : reachState.status
  const sheetPeek = !routing ? (
    <LayerPeek
      layer={layer}
      basemap={basemap}
      placeKinds={placeKinds}
      collisionSpots={spots}
      collisionFilters={collisions}
      theftSpots={shownTheftSpots}
      theftFilters={thefts}
      pathwayFilters={pathways}
      comfortFilters={comfortPicks}
      constructionFilters={construction}
    />
  ) : route ? (
    <RoutePeek route={route} travel={travel} view={routeColoured} />
  ) : reach ? (
    <ReachPeek minutes={minutes} basemap={basemap} />
  ) : planning || reaching ? (
    <span className="peek-text">
      {status === 'error'
        ? t(planning ? 'routeError' : 'reachError')
        : status === 'loading'
          ? t(planning ? 'routeLoading' : 'reachLoading')
          : t(planning ? 'peek.routeHint' : 'peek.reachHint')}
    </span>
  ) : null

  // Details of the selection: a popup beside it on the map, or the bottom sheet on phones.
  const details =
    // Planning, places open a card, and the route's barriers and roadwork.
    !selected || (routing && !['place', 'closure', 'barrier'].includes(selected.kind)) ? null : selected.kind ===
      'route' ? (
      <BikeRouteCard
        selected={selected}
        onClose={() => setSelected(null)}
        onFocus={(focus) => setSelected({ ...selected, focus })}
      />
    ) : selected.kind === 'collision' ? (
      <CollisionCard
        items={spotByKey.get(selected.spot)?.items ?? []}
        at={selected.at}
        basemap={basemap}
        onClose={() => setSelected(null)}
      />
    ) : selected.kind === 'construction' ? (
      <ConstructionCard project={selected.props} basemap={basemap} onClose={() => setSelected(null)} />
    ) : selected.kind === 'closure' ? (
      (() => {
        const closure = closures?.find((c) => c.id === selected.id)
        return closure ? (
          <ConstructionCard closure={closure} basemap={basemap} onClose={() => setSelected(null)} />
        ) : null
      })()
    ) : selected.kind === 'barrier' ? (
      <BarrierCard barrier={selected.barrier} at={selected.at} onClose={() => setSelected(null)} />
    ) : selected.kind === 'theft' ? (
      <TheftCard
        items={theftSpotByKey.get(selected.spot)?.items ?? []}
        at={selected.at}
        onClose={() => setSelected(null)}
      />
    ) : (
      <FeatureCard
        selected={selected}
        onClose={() => setSelected(null)}
        onRouteHere={ROUTER_URL ? (label) => routeHere(selected.at, label) : undefined}
      />
    )

  return (
    <LangContext.Provider value={i18n}>
      <MapView
        state={styleState}
        onSelect={setSelected}
        popup={details && !phone ? details : null}
        onBasemapChange={setBasemap}
        onBikeLanesChange={ownBikeLanes ? setPathwayBikeLanes : setBikeLanes}
        onBikeRoutesChange={changeBikeRoutes}
        onWardsChange={setWards}
        onRoadworkChange={setRoadwork}
        onLightsChange={setLights}
        onRouteStopsChange={setRouteStops}
        routing={mapRouting}
        reach={reachShape}
        found={routing ? null : (found?.lngLat ?? null)}
      />
      <div className="sidebar">
        <div className={`card topbar ${topOpen ? '' : 'folded'}`} ref={topbar}>
          <header className="brand">
            <img className="brand-logo" src={`${import.meta.env.BASE_URL}logo.png`} alt="" height="28" />
            <h1>{REGION.title[lang]}</h1>
          </header>
          <div className="topbar-row">
            <ModeSwitch mode={mode} onChange={changeMode} />
            <button
              type="button"
              className="lang-button"
              aria-label={t('switchLang')}
              onClick={() => setLang(lang === 'en' ? 'fr' : 'en')}
            >
              {t('switchLangShort')}
            </button>
          </div>
          {!routing && (
            <PlaceInput
              id="search"
              label={t('search')}
              marker="search"
              point={found && { lngLat: found.lngLat, label: found.label }}
              // Where the device is comes as a point alone: found like a search result.
              onChange={(point, place) =>
                findPlace(
                  point ? (place ?? { label: point.label ?? '', name: point.label, lngLat: point.lngLat }) : null,
                )
              }
            />
          )}
          {!routing ? (
            <LayerPicker active={layer} onChange={changeLayer} />
          ) : !planning && !reaching ? (
            <p className="route-message">{t('noRouter')}</p>
          ) : reaching ? (
            <ReachForm
              start={points[0]}
              minutes={minutes}
              picker={picker}
              onStartChange={setStart}
              onMinutesChange={changeMinutes}
            />
          ) : (
            <RouteForm
              points={points}
              picker={picker}
              onPointChange={setPoint}
              vias={viaPoints}
              onViaChange={changeVia}
              onReverse={() => update({ points: [points[1], points[0]], vias: [...vias].reverse() })}
            />
          )}
          {phone && planning && !topOpen && <RouteSummary points={points} onOpen={() => setTopOpen(true)} />}
          {/* On phones the panel folds down to the mode switch, to leave the map room. */}
          {phone && (
            <button
              type="button"
              className="topbar-toggle"
              aria-expanded={topOpen}
              aria-label={t('toggleTop')}
              onClick={() => setTopOpen(!topOpen)}
            />
          )}
        </div>
        <div
          className={`card sheet ${sheetOpen ? '' : 'collapsed'} ${routing && !planning && !reaching ? 'empty' : ''}`}
          ref={sheet}
        >
          <button
            type="button"
            className="sheet-toggle"
            aria-expanded={sheetOpen}
            aria-label={t('toggleSheet')}
            onClick={() => setSheetOpen(!sheetOpen)}
          >
            <span className="sheet-handle" aria-hidden="true" />
            <span className="sheet-summary">
              <span className="sheet-title">{sheetTitle}</span>
              {sheetPeek && <span className="sheet-peek">{sheetPeek}</span>}
            </span>
            <svg
              aria-hidden="true"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={sheetOpen ? 'M4 7l5 5 5-5' : 'M4 11l5-5 5 5'} />
            </svg>
          </button>
          <div className="sheet-body">
            {/* A place tapped while planning comes first, above the result. */}
            {phone && details}
            {planning && (
              <RouteResult
                travel={travel}
                state={routeState}
                route={route}
                routes={plannedRoutes}
                choice={choice}
                onChoose={chooseRoute}
                view={routeView}
                onViewChange={changeRouteView}
                hover={routeHover}
                onHover={setRouteHover}
                highlight={routeHighlight}
                pinned={pinnedPart}
                onPointPart={setPointedPart}
                onPinPart={setPinnedPart}
              />
            )}
            {reaching && (
              <ReachResult
                state={reachState}
                minutes={minutes}
                area={area}
                view={reachView}
                onViewChange={setReachView}
                places={reachPlaces}
                picked={pickedKinds.length > 0}
                pinned={pinnedKind}
                onPoint={setPointedKind}
                onPin={setPinnedKind}
              />
            )}
            <div className={(phone && details) || hasResult ? 'sheet-rest when-selected' : 'sheet-rest'}>
              {!routing && (
                <Legend
                  layer={layer}
                  comfortFilters={comfortPicks}
                  onComfortFiltersChange={changeComfort}
                  comfortTotals={tileMeta?.comfort ?? null}
                  basemap={basemap}
                  placeKinds={placeKinds}
                  onPlaceKindsChange={changePlaceKinds}
                  collisionSpots={spots}
                  collisions={collisionData}
                  busiestSpot={busiestSpot}
                  collisionFilters={collisions}
                  onCollisionFiltersChange={changeCollisions}
                  theftSpots={shownTheftSpots}
                  thefts={theftData}
                  busiestTheftSpot={busiestTheftSpot}
                  theftFilters={thefts}
                  onTheftFiltersChange={changeThefts}
                  constructionFilters={construction}
                  onConstructionFiltersChange={changeConstruction}
                  projects={projects}
                  pathwayFilters={pathways}
                  onPathwayFiltersChange={changePathways}
                  pathwayTotals={tileMeta?.pathways?.rows ? tileMeta.pathways : null}
                />
              )}
              <p className="footnote">
                {dataDate && (
                  <>
                    {t('updated')} {dataDate}
                    {' · '}
                  </>
                )}
                <HowToHelp />
                <br />
                {!phone && (
                  <>
                    {/* The map moves without re-rendering this, so the link is
                        pointed at the current view just before it is used. */}
                    <a
                      href="https://www.openstreetmap.org/"
                      target="_blank"
                      rel="noopener noreferrer"
                      onPointerEnter={followMap}
                      onFocus={followMap}
                    >
                      OpenStreetMap
                    </a>
                    {' · '}
                  </>
                )}
                {REGION.org && (
                  <>
                    <a href={REGION.org.url} target="_blank" rel="noopener noreferrer">
                      {REGION.org.name}
                    </a>
                    {' · '}
                  </>
                )}
                <a href={REGION.repo} target="_blank" rel="noopener noreferrer">
                  GitHub
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </LangContext.Provider>
  )
}
