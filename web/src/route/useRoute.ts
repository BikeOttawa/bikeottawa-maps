import { useEffect, useState } from 'react'
import { MAX_ROUTES, offered } from './alternatives'
import { fetchRoute, type LngLat, type Route } from './brouter'
import type { RoutePoints } from './state'
import type { Profile } from './styles'

/** A trip's routes, the router's best first; the others come in after it. */
export type RouteState =
  | { status: 'idle' }
  | { status: 'loading'; previous: Route[] }
  | { status: 'ready'; routes: Route[] }
  | { status: 'error'; message: string }

/** Small pause so dragging a marker or a slider doesn't fire a request per pixel. */
const DEBOUNCE_MS = 150

/** Alternatives are asked for once the points have stayed put this long after the best came. */
const ALTERNATIVES_AFTER_MS = 400

export function useRoute(
  routerUrl: string | null,
  points: RoutePoints,
  vias: readonly LngLat[],
  profile: Profile,
  enabled: boolean,
): RouteState {
  const [state, setState] = useState<RouteState>({ status: 'idle' })
  const [from, to] = points
  const key = enabled && routerUrl && from && to ? JSON.stringify([from.lngLat, vias, to.lngLat, profile]) : null

  // biome-ignore lint/correctness/useExhaustiveDependencies: key captures every input that changes the route
  useEffect(() => {
    if (!key || !routerUrl || !from || !to) {
      setState({ status: 'idle' })
      return
    }
    const controller = new AbortController()
    const { signal } = controller
    const stops = [from.lngLat, ...vias, to.lngLat]
    let later: ReturnType<typeof setTimeout> | undefined
    setState((current) => ({
      status: 'loading',
      previous: current.status === 'ready' ? current.routes : current.status === 'loading' ? current.previous : [],
    }))
    const timer = setTimeout(() => {
      fetchRoute(routerUrl, stops, profile, signal)
        .then((best) => {
          setState({ status: 'ready', routes: [best] })
          // Then the next best, each added as it comes if worth offering; a new trip cancels them.
          later = setTimeout(() => {
            const alternatives: (Route | null)[] = []
            for (let i = 1; i < MAX_ROUTES; i++) {
              fetchRoute(routerUrl, stops, profile, signal, i)
                .then((route) => {
                  alternatives[i - 1] = route
                  if (!signal.aborted) setState({ status: 'ready', routes: offered(best, alternatives) })
                })
                .catch(() => {})
            }
          }, ALTERNATIVES_AFTER_MS)
        })
        .catch((error: unknown) => {
          if (!signal.aborted)
            setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
        })
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      clearTimeout(later)
      controller.abort()
    }
  }, [key, routerUrl])

  return state
}

/** The routes to draw: the current ones, or the last ones while new ones load. */
export function visibleRoutes(state: RouteState): Route[] {
  if (state.status === 'ready') return state.routes
  if (state.status === 'loading') return state.previous
  return NO_ROUTES
}

const NO_ROUTES: Route[] = []
