import {
  addProtocol,
  type GeoJSONSource,
  GeolocateControl,
  LngLatBounds,
  Map as MapLibreMap,
  Marker,
  NavigationControl,
  Popup,
  ScaleControl,
  setWorkerUrl,
} from 'maplibre-gl'
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url'
import { Protocol } from 'pmtiles'
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import 'maplibre-gl/dist/maplibre-gl.css'
import { BasemapSwitch } from '../components/BasemapSwitch'
import { RouteStopsSwitch } from '../components/RouteStopsSwitch'
import { ASSETS_BASE, REGION } from '../config'
import type { BasemapId } from '../layers'
import { isPlaceKind, placeImageId } from '../places'
import { partOf } from '../route/breakdown'
import { type LngLat, type RouteHighlight, STOP_KINDS } from '../route/brouter'
import { nearestOnRoute, pointAtDistance, routeProfile } from '../route/profile'
import type { ReachShape } from '../route/reachArea'
import type { RoutePoints } from '../route/state'
import { CLOSURE_IMAGE, renderClosureImage } from './closureImage'
import { PIE_PREFIX, renderPieImage } from './pieImage'
import { renderPlaceImage } from './placeImage'
import { BUBBLE_IMAGE, renderBubbleImage, renderStopImage } from './stopImage'
import { streetAlong } from './streetAlong'
import {
  buildStyle,
  INTERACTIVE_LAYERS,
  PLACES_SOURCE,
  PLACES_UNMERGED_FROM,
  REACH_SOURCE,
  ROADWORK_LAYERS,
  ROUTE_LAYERS,
  type Selected,
  type StyleState,
  stopImageId,
} from './style'

// MapLibre finds its worker relative to its own file, which bundling breaks, so point it at the bundled copy.
setWorkerUrl(workerUrl)
addProtocol('pmtiles', new Protocol().tile)

/** How far around a click or tap, in pixels, a feature still counts as hit. */
const HIT_RADIUS = 8

/** A trip's routes not chosen, and their time bubbles: a click picks one. */
const OTHER_ROUTE_LAYERS = ['route-others-label', 'route-others-line', 'route-others-casing']

/** The route's stop icons and their bubbles: barriers and roadwork open a card. */
const ROUTE_STOP_LAYERS = ['route-stops', 'route-stops-bubble']
/** How close to the route, in pixels, the pointer has to be to mark a spot on it. */
const ROUTE_HOVER_RADIUS = 16
/** The basemap only covers the region, so panning stops a little beyond it. */
const BOUNDS_MARGIN = 0.05
const PHONE_LAYOUT = '(max-width: 720px)'
/** How close the map comes in, at least, to a place found by a search. */
const FOUND_ZOOM = 17

interface Props {
  state: StyleState
  onSelect: (selected: Selected | null) => void
  onBasemapChange: (basemap: BasemapId) => void
  onBikeLanesChange: (on: boolean) => void
  onBikeRoutesChange: (on: boolean) => void
  onWardsChange: (on: boolean) => void
  onRoadworkChange: (on: boolean) => void
  onLightsChange: (on: boolean) => void
  onRouteStopsChange: (on: boolean) => void
  /** Details of the selection, shown in a popup beside it. Null where they go elsewhere (phones). */
  popup: ReactNode | null
  /** How far you get, drawn when the style has a reach source. */
  reach: ReachShape | null
  /** A place picked from a search: marked, and flown to when it changes. */
  found: LngLat | null
  /** When set, clicks place route points instead of selecting features; places can still be picked. */
  routing: {
    points: RoutePoints
    onMapClick: (lngLat: LngLat) => void
    /** Places the route must pass through, in riding order. */
    vias: readonly LngLat[]
    onMovePoint: (index: 0 | 1, lngLat: LngLat) => void
    onAddVia: (index: number, lngLat: LngLat) => void
    onMoveVia: (index: number, lngLat: LngLat) => void
    onRemoveVia: (index: number) => void
    /** Metres along the route being pointed at, here or on the elevation chart. */
    hover: number | null
    onHover: (distance: number | null) => void
    /** Legend item to bring into view when it changes. */
    zoomTo: RouteHighlight | null
    /** Marker that shows a spinner while its result is on the way: B for a route, A for how far. */
    busy?: 0 | 1 | null
    /** Picks one of the trip's other routes, drawn grey, by its place among them. */
    onChooseRoute: (index: number) => void
  } | null
}

function markerElement(index: 0 | 1): HTMLElement {
  const el = document.createElement('div')
  el.className = `route-marker ${index === 0 ? 'start' : 'end'}`
  el.textContent = index === 0 ? 'A' : 'B'
  return el
}

/** Room the panels take, so a fitted route is not hidden under them. */
function panelPadding() {
  if (window.matchMedia(PHONE_LAYOUT).matches) {
    const sheet = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sheet-height')) || 0
    return { top: 200, bottom: sheet + 24, left: 30, right: 30 }
  }
  return { top: 50, bottom: 50, left: 420, right: 70 }
}

/** The reach data last handed to the map, and the source object it went to. */
interface ReachShown {
  source: unknown
  data: ReachShape | null
}

const NO_REACH: ReachShape = { type: 'FeatureCollection', features: [] }

/** Puts the reach lines on the map's reach source, if it has one and they are not there yet. */
function showReach(map: MapLibreMap, data: ReachShape | null, shown: { current: ReachShown }) {
  const source = map.getSource<GeoJSONSource>(REACH_SOURCE)
  if (!source || (shown.current.source === source && shown.current.data === data)) return
  if (shown.current.source !== source) {
    // A style update compares each source as the map reports it with the new
    // style, where the reach source is always empty: told the lines, it would
    // empty the source, to be cut into tiles all over again when refilled. So
    // the source reports itself as the style has it, and is left alone.
    const serialize = source.serialize.bind(source)
    source.serialize = () => ({ ...serialize(), data: NO_REACH })
  }
  source.setData(data ?? NO_REACH)
  shown.current = { source, data }
}

export function MapView({
  state,
  onSelect,
  onBasemapChange,
  onBikeLanesChange,
  onBikeRoutesChange,
  onWardsChange,
  onRoadworkChange,
  onLightsChange,
  onRouteStopsChange,
  popup,
  reach,
  found,
  routing,
}: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const markers = useRef<(Marker | null)[]>([null, null])
  const hoverMarker = useRef<Marker | null>(null)
  const viaMarkers = useRef<Marker[]>([])
  const foundMarker = useRef<Marker | null>(null)
  // True while the hover dot is being dragged out into a via point.
  const dragging = useRef(false)
  const profile = useMemo(() => (state.route ? routeProfile(state.route.coords) : []), [state.route])
  // Home of the map-style switcher, placed by MapLibre among its own controls.
  const [styleControl, setStyleControl] = useState<HTMLElement | null>(null)
  const [stopsControl, setStopsControl] = useState<HTMLElement | null>(null)
  // The popup's content element lives as long as the map view; React renders into it.
  const popupElement = useMemo(() => document.createElement('div'), [])
  const popupRef = useRef<Popup | null>(null)
  const latest = useRef({ state, onSelect, routing, profile, reach })
  const applied = useRef(state)
  latest.current = { state, onSelect, routing, profile, reach }
  const reachShown = useRef<ReachShown>({ source: null, data: null })
  // Whether the first style has loaded, and whether a change is waiting for it.
  const styleReady = useRef(false)
  const styleWait = useRef(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the map is created once; later state goes through setStyle below
  useEffect(() => {
    if (!container.current) return
    const [west, south, east, north] = REGION.bbox
    const map = new MapLibreMap({
      container: container.current,
      style: buildStyle(state, ASSETS_BASE),
      center: REGION.center,
      zoom: 12.5,
      minZoom: 9,
      maxZoom: 20,
      maxBounds: [
        [west - BOUNDS_MARGIN, south - BOUNDS_MARGIN],
        [east + BOUNDS_MARGIN, north + BOUNDS_MARGIN],
      ],
      hash: 'map',
      dragRotate: false,
      attributionControl: { compact: true },
    })
    map.touchZoomRotate.disableRotation()
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(
      new GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true }),
      'top-right',
    )
    const switcher = document.createElement('div')
    switcher.className = 'maplibregl-ctrl maplibregl-ctrl-group basemap-ctrl'
    map.addControl({ onAdd: () => switcher, onRemove: () => switcher.remove() }, 'top-right')
    setStyleControl(switcher)
    // Under it, while a route is shown: its stops on or off. Empty, it is hidden.
    const stops = document.createElement('div')
    stops.className = 'maplibregl-ctrl maplibregl-ctrl-group route-stops-ctrl'
    map.addControl({ onAdd: () => stops, onRemove: () => stops.remove() }, 'top-right')
    setStopsControl(stops)
    map.addControl(new ScaleControl({ unit: 'metric' }), 'bottom-left')

    // Markers are drawn the first time a style asks for them; a style rebuilt
    // from scratch (new basemap) simply asks again.
    map.setMissingStyleImageResolver((id) => {
      if (map.hasImage(id)) return
      const place = id.slice(placeImageId('').length)
      if (id === BUBBLE_IMAGE) {
        const bubble = renderBubbleImage()
        if (bubble) {
          const { image, ...options } = bubble
          map.addImage(id, image, options)
        }
        return
      }
      const stop = STOP_KINDS.find((kind) => id === stopImageId(kind))
      const marker = stop
        ? renderStopImage(stop)
        : id === CLOSURE_IMAGE
          ? renderClosureImage()
          : id.startsWith(PIE_PREFIX)
            ? renderPieImage(id)
            : id.startsWith(placeImageId('')) && isPlaceKind(place)
              ? renderPlaceImage(place)
              : null
      if (marker) map.addImage(id, marker.image, { pixelRatio: marker.pixelRatio })
    })

    const featureAt = (point: { x: number; y: number }, lngLat: { lng: number; lat: number }): Selected | null => {
      // Planning a route or how far, only places and the route's barriers and roadwork are
      // picked; a click anywhere else is a route point.
      const { routing, state } = latest.current
      const overlays = routing ? ROUTE_STOP_LAYERS : [...ROADWORK_LAYERS, ...ROUTE_LAYERS]
      const layers = [...INTERACTIVE_LAYERS[state.layer], ...overlays].filter(
        (id) =>
          map.getLayer(id) && (!routing || INTERACTIVE_LAYERS.places.includes(id) || ROUTE_STOP_LAYERS.includes(id)),
      )
      if (!layers.length) return null
      const hits = map.queryRenderedFeatures(
        [
          [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
          [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
        ],
        { layers },
      )
      // Stop signs and lights have nothing more to show.
      const [feature] = hits.filter(
        (hit) => !ROUTE_STOP_LAYERS.includes(hit.layer.id) || ['barrier', 'roadwork'].includes(hit.properties.kind),
      )
      if (!feature) return null
      // Merged spots open nothing: a click zooms in until they split.
      if (feature.properties.cluster) return null
      if (ROUTE_STOP_LAYERS.includes(feature.layer.id) && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        const { closure, barrier } = feature.properties
        if (closure) return { kind: 'closure', id: String(closure), at: [x, y] }
        if (barrier) return { kind: 'barrier', barrier: String(barrier), at: [x, y] }
        return null
      }
      if (feature.layer.id === 'closures-icon' && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        return { kind: 'closure', id: String(feature.properties.id), at: [x, y] }
      }
      if (feature.layer.id === 'closures-line') {
        return { kind: 'closure', id: String(feature.properties.id), at: [lngLat.lng, lngLat.lat] }
      }
      if (feature.layer.id === 'construction-line' || feature.layer.id === 'construction-point') {
        // A point project is anchored at itself, a line where it was clicked.
        const at = feature.geometry.type === 'Point' ? (feature.geometry.coordinates as [number, number]) : null
        // The City gives no place name: the street the project runs along there, from the basemap's
        // roads near the click, in the language shown.
        const reach = 2 * HIT_RADIUS
        const streets = map
          .queryRenderedFeatures([
            [point.x - reach, point.y - reach],
            [point.x + reach, point.y + reach],
          ])
          .filter((f) => f.sourceLayer === 'roads' && f.properties.name)
          .map((f) => ({ name: String(f.properties[`name:${state.lang}`] ?? f.properties.name), geometry: f.geometry }))
        const street = streetAlong([lngLat.lng, lngLat.lat], feature.geometry, streets) ?? undefined
        return {
          kind: 'construction',
          props: { ...feature.properties, ...(street && { street }) },
          at: at ?? [lngLat.lng, lngLat.lat],
        }
      }
      if (feature.layer.id.startsWith('thefts-') && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        return { kind: 'theft', spot: String(feature.properties.key), at: [x, y] }
      }
      if (feature.layer.id.startsWith('collisions-') && feature.geometry.type === 'Point') {
        const [x, y] = feature.geometry.coordinates
        return { kind: 'collision', spot: String(feature.properties.key), at: [x, y] }
      }
      if (feature.layer.id === 'routes-band') {
        const routes = String(feature.properties.routes ?? '').split(',')
        return { kind: 'route', routes, focus: routes[0], at: [lngLat.lng, lngLat.lat] }
      }
      if (feature.sourceLayer === 'places') {
        // A place is anchored at its own position, a street where it was clicked.
        const at = feature.geometry.type === 'Point' ? (feature.geometry.coordinates as [number, number]) : null
        return {
          kind: 'place',
          osm: String(feature.properties.osm),
          props: feature.properties,
          at: at ?? [lngLat.lng, lngLat.lat],
        }
      }
      return { kind: 'way', id: Number(feature.id), props: feature.properties, at: [lngLat.lng, lngLat.lat] }
    }
    // A merged spot of collisions or thefts under the pointer, as its source and id.
    const mergedAt = (point: { x: number; y: number }) => {
      const layers = INTERACTIVE_LAYERS[latest.current.state.layer].filter((id) => map.getLayer(id))
      if (latest.current.routing || !layers.length) return null
      const box: [[number, number], [number, number]] = [
        [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
        [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
      ]
      const [feature] = map.queryRenderedFeatures(box, { layers })
      if (feature?.geometry.type !== 'Point') return null
      const at = feature.geometry.coordinates as [number, number]
      if (feature.properties.cluster) return { source: feature.source, id: Number(feature.properties.cluster_id), at }
      // A place left alone among merged ones has no details: a click zooms in to its marker.
      if (feature.layer.id.startsWith('places-merged-')) return { source: feature.source, id: null, at }
      return null
    }

    // Planning, the other route under the pointer, by its place among the trip's routes.
    const otherRouteAt = (point: { x: number; y: number }): number | null => {
      const layers = OTHER_ROUTE_LAYERS.filter((id) => map.getLayer(id))
      if (!latest.current.routing || !layers.length) return null
      const [hit] = map.queryRenderedFeatures(
        [
          [point.x - HIT_RADIUS, point.y - HIT_RADIUS],
          [point.x + HIT_RADIUS, point.y + HIT_RADIUS],
        ],
        { layers },
      )
      return hit ? Number(hit.properties.choice) : null
    }

    map.on('click', (e) => {
      const merged = mergedAt(e.point)
      if (merged) {
        const { id, at } = merged
        if (id === null) map.easeTo({ center: at, zoom: Math.max(map.getZoom() + 1, PLACES_UNMERGED_FROM) })
        else
          map
            .getSource<GeoJSONSource>(merged.source)
            ?.getClusterExpansionZoom(id)
            .then((zoom) => map.easeTo({ center: at, zoom }))
            .catch(() => {})
        return
      }
      const { routing, onSelect } = latest.current
      const feature = featureAt(e.point, e.lngLat)
      const other = feature ? null : otherRouteAt(e.point)
      if (routing && other !== null) {
        routing.onChooseRoute(other)
        return
      }
      onSelect(feature)
      if (routing && !feature) routing.onMapClick([e.lngLat.lng, e.lngLat.lat])
    })
    map.on('mousemove', (e) => {
      const { routing, profile } = latest.current
      const overFeature =
        featureAt(e.point, e.lngLat) !== null || mergedAt(e.point) !== null || otherRouteAt(e.point) !== null
      if (!routing) {
        map.getCanvas().style.cursor = overFeature ? 'pointer' : ''
        return
      }
      if (dragging.current) return
      map.getCanvas().style.cursor = overFeature ? 'pointer' : routing.points.includes(null) ? 'crosshair' : ''
      // Pointing near the route marks that spot on the elevation chart.
      const hit = nearestOnRoute(profile, [e.lngLat.lng, e.lngLat.lat])
      const metresPerPixel = (40075016.686 * Math.cos((e.lngLat.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom())
      const near = hit !== null && hit.off <= ROUTE_HOVER_RADIUS * metresPerPixel
      if (near || routing.hover !== null) routing.onHover(near ? hit.point.distance : null)
    })
    map.on('mouseout', (e) => {
      // Moving onto the hover dot itself is not leaving the route.
      const onto = e.originalEvent.relatedTarget
      const ontoDot = onto instanceof Node && hoverMarker.current?.getElement().contains(onto)
      if (!dragging.current && !ontoDot) latest.current.routing?.onHover(null)
    })

    // A rebuilt style brings an empty reach source; fill it again.
    map.on('styledata', () => showReach(map, latest.current.reach, reachShown))
    map.once('style.load', () => {
      styleReady.current = true
    })

    mapRef.current = map
    applied.current = state
    return () => {
      mapRef.current = null
      markers.current = [null, null]
      hoverMarker.current = null
      viaMarkers.current = []
      foundMarker.current = null
      popupRef.current = null
      styleReady.current = false
      styleWait.current = false
      // MapLibre deletes its position from the URL when removed. Put it back so a
      // remount (React does one in development) starts where the link pointed.
      const { hash, pathname, search } = window.location
      map.remove()
      window.history.replaceState(window.history.state, '', hash || pathname + search)
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map || applied.current === state) return
    const routeChanged = applied.current.route !== state.route
    applied.current = state
    // A style can only be diffed once it has loaded; until then wait rather than
    // restart loading from scratch. Only the style itself: isStyleLoaded() is
    // also false while any tile loads, which kept a new layer waiting until the
    // whole map had loaded, many seconds on a slow connection.
    const apply = () => {
      styleWait.current = false
      map.setStyle(buildStyle(latest.current.state, ASSETS_BASE))
      // A style rebuilt from scratch has a new, empty reach source to fill.
      showReach(map, latest.current.reach, reachShown)
    }
    if (styleReady.current) apply()
    else if (!styleWait.current) {
      styleWait.current = true
      map.once('style.load', apply)
    }

    // Bring a new route into view, unless all of it already shows clear of the panels.
    if (routeChanged && state.route && state.route.coords.length > 1) {
      const bounds = new LngLatBounds()
      for (const [lon, lat] of state.route.coords) bounds.extend([lon, lat])
      const padding = panelPadding()
      const { width, height } = map.getContainer().getBoundingClientRect()
      const visible = [bounds.getSouthWest(), bounds.getNorthEast()].every((corner) => {
        const { x, y } = map.project(corner)
        return x >= padding.left && x <= width - padding.right && y >= padding.top && y <= height - padding.bottom
      })
      if (!visible) map.fitBounds(bounds, { padding, maxZoom: 16, duration: 600 })
    }
  }, [state])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    // While a style is still loading its source may not exist yet; try again once it settles.
    showReach(map, reach, reachShown)
    const retry = () => showReach(map, reach, reachShown)
    map.once('idle', retry)
    return () => {
      map.off('idle', retry)
    }
  }, [reach])

  // Draggable A and B markers follow the route points.
  const points = routing?.points
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    for (const index of [0, 1] as const) {
      const point = points?.[index] ?? null
      let marker = markers.current[index]
      if (!point) {
        marker?.remove()
        markers.current[index] = null
        continue
      }
      if (!marker) {
        marker = new Marker({ element: markerElement(index), draggable: true }).setLngLat(point.lngLat).addTo(map)
        const created = marker
        created.on('dragend', () => {
          const { lng, lat } = created.getLngLat()
          latest.current.routing?.onMovePoint(index, [lng, lat])
        })
        markers.current[index] = marker
      } else {
        marker.setLngLat(point.lngLat)
      }
    }
  }, [points])

  // A spinner around a marker while the result for it is on its way.
  const busy = routing?.busy ?? null
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new point can bring a new marker, which needs the class too
  useEffect(() => {
    for (const [index, marker] of markers.current.entries()) {
      marker?.getElement().classList.toggle('busy', busy === index)
    }
  }, [busy, points])

  // Clicking an item of the route legend brings its stretches or signs into view. The
  // route is read at that moment, so a new route alone does not move the map.
  const zoomTo = routing?.zoomTo ?? null
  useEffect(() => {
    const map = mapRef.current
    const { route, routeView = 'comfort' } = latest.current.state
    if (!map || !route || !zoomTo) return
    const bounds = new LngLatBounds()
    for (const segment of route.segments) {
      if (partOf(segment, routeView) === zoomTo) for (const point of segment.coords) bounds.extend(point)
    }
    for (const stop of route.stops) {
      if (stop.kind === zoomTo) bounds.extend(stop.lngLat)
    }
    if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: panelPadding(), maxZoom: 17, duration: 600 })
  }, [zoomTo])

  // A place found by a search: a dot marks it, and the map goes there, clear of
  // the panels. Only a new search moves the map: the dot coming back on return
  // to exploring leaves it where it is.
  const flownTo = useRef<LngLat | null>(null)
  useEffect(() => {
    const map = mapRef.current
    foundMarker.current?.remove()
    foundMarker.current = null
    if (!map || !found) return
    const element = document.createElement('div')
    element.className = 'found-marker'
    foundMarker.current = new Marker({ element }).setLngLat(found).addTo(map)
    if (flownTo.current === found) return
    flownTo.current = found
    const { top, bottom, left, right } = panelPadding()
    map.flyTo({
      center: found,
      zoom: Math.max(map.getZoom(), FOUND_ZOOM),
      offset: [(left - right) / 2, (top - bottom) / 2],
    })
  }, [found])

  // A searched place that is also one of the map's own gets the map's details
  // of it (kind, hours, photos) once its tile has loaded.
  const searched = state.selected?.kind === 'place' && state.selected.searched ? state.selected : null
  useEffect(() => {
    const map = mapRef.current
    if (!map || !searched?.osm) return
    const look = () => {
      if (!map.getSource(PLACES_SOURCE)) return
      const [feature] = map.querySourceFeatures(PLACES_SOURCE, {
        sourceLayer: 'places',
        filter: ['==', ['get', 'osm'], searched.osm],
      })
      if (!feature) return
      map.off('sourcedata', look)
      const { osm, at, props } = searched
      latest.current.onSelect({ kind: 'place', osm, at, props: { ...props, ...feature.properties } })
    }
    map.on('sourcedata', look)
    look()
    return () => {
      map.off('sourcedata', look)
    }
  }, [searched])

  // The details popup follows the selection. It is shown only when there is content for it.
  const anchor = popup ? (state.selected?.at ?? null) : null
  const [anchorLng, anchorLat] = anchor ?? [null, null]
  useEffect(() => {
    const map = mapRef.current
    if (!map || anchorLng === null || anchorLat === null) {
      popupRef.current?.remove()
      popupRef.current = null
      return
    }
    if (!popupRef.current) {
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        maxWidth: '340px',
        offset: 14,
        className: 'feature-popup',
      }).setDOMContent(popupElement)
    }
    popupRef.current.setLngLat([anchorLng, anchorLat]).addTo(map)

    // MapLibre keeps the popup inside the map but knows nothing of the side panel; nudge the map if they overlap.
    // While the map is on its way to a place found by a search, wait: nudging now would stop it.
    const nudge = () => {
      const box = popupRef.current?.getElement()?.getBoundingClientRect()
      const panel = document.querySelector('.sidebar')?.getBoundingClientRect()
      if (box && panel && box.left < panel.right + 12) map.panBy([box.left - panel.right - 12, 0], { duration: 300 })
    }
    const frame = requestAnimationFrame(() => (map.isMoving() ? map.once('moveend', nudge) : nudge()))
    return () => {
      cancelAnimationFrame(frame)
      map.off('moveend', nudge)
    }
  }, [anchorLng, anchorLat, popupElement])

  // Via points: drag to move, click to remove.
  const vias = routing?.vias
  useEffect(() => {
    const map = mapRef.current
    for (const marker of viaMarkers.current) marker.remove()
    viaMarkers.current = []
    if (!map || !vias) return
    viaMarkers.current = vias.map((lngLat, index) => {
      const el = document.createElement('div')
      el.className = 'route-marker via'
      const marker = new Marker({ element: el, draggable: true }).setLngLat(lngLat).addTo(map)
      let moved = false
      marker.on('dragstart', () => {
        moved = true
      })
      marker.on('dragend', () => {
        const { lng, lat } = marker.getLngLat()
        latest.current.routing?.onMoveVia(index, [lng, lat])
      })
      // The browser also reports a click at the end of a drag; only a plain click removes.
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!moved) latest.current.routing?.onRemoveVia(index)
        moved = false
      })
      return marker
    })
  }, [vias])

  // A dot on the route at the spot being pointed at, on the map or on the elevation
  // chart. Dragging it off the route anchors a via point where it is dropped.
  const hover = routing?.hover ?? null
  useEffect(() => {
    const map = mapRef.current
    if (dragging.current) return
    const spot = hover === null ? null : pointAtDistance(profile, hover)
    if (!map || !spot) {
      hoverMarker.current?.remove()
      hoverMarker.current = null
      return
    }
    if (hoverMarker.current) {
      hoverMarker.current.setLngLat(spot.lngLat)
      return
    }
    const el = document.createElement('div')
    el.className = 'route-hover'
    const marker = new Marker({ element: el, draggable: true }).setLngLat(spot.lngLat).addTo(map)
    let grabbedAt = 0
    marker.on('dragstart', () => {
      dragging.current = true
      grabbedAt = latest.current.routing?.hover ?? 0
    })
    marker.on('dragend', () => {
      dragging.current = false
      const { routing, profile } = latest.current
      if (!routing) return
      // The new point goes after every via point the route reaches before the grabbed spot.
      const before = routing.vias.filter((via) => (nearestOnRoute(profile, via)?.point.distance ?? 0) < grabbedAt)
      const { lng, lat } = marker.getLngLat()
      routing.onAddVia(before.length, [lng, lat])
      routing.onHover(null)
    })
    // Leaving the dot for anything but the map (a panel, say) ends the hover.
    el.addEventListener('mouseleave', (e) => {
      if (!dragging.current && !(e.relatedTarget instanceof HTMLCanvasElement)) latest.current.routing?.onHover(null)
    })
    hoverMarker.current = marker
  }, [hover, profile])

  return (
    <>
      <div ref={container} className="map" />
      {styleControl &&
        createPortal(
          <BasemapSwitch
            basemap={state.basemap}
            onChange={onBasemapChange}
            bikeLanes={Boolean(state.bikeLanes)}
            onBikeLanesChange={onBikeLanesChange}
            bikeRoutes={Boolean(state.bikeRoutes)}
            onBikeRoutesChange={onBikeRoutesChange}
            wards={Boolean(state.wards)}
            onWardsChange={onWardsChange}
            roadwork={Boolean(state.roadwork)}
            onRoadworkChange={onRoadworkChange}
            lights={Boolean(state.lights)}
            onLightsChange={onLightsChange}
          />,
          styleControl,
        )}
      {stopsControl &&
        state.route &&
        createPortal(<RouteStopsSwitch on={state.routeStops ?? true} onChange={onRouteStopsChange} />, stopsControl)}
      {popup && createPortal(popup, popupElement)}
    </>
  )
}
