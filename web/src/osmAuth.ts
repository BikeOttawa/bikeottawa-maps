import { OSM_API, OSM_CLIENT_ID, OSM_URL } from './config'
import { osmApi } from './osmEdit'
import { REGION } from './region'

/**
 * Signing in to OpenStreetMap, with OAuth 2 and PKCE: there is no secret, so
 * it works from a static site. OSM's sign-in opens in a popup and comes back
 * to land.html, which hands the answer over. An installed app goes to OSM and
 * back instead: its popups open in a browser of their own that cannot hand
 * anything back.
 */

const SCOPES = 'read_prefs write_api write_notes'
const USER_KEY = 'osm-user'
// Shared with public/land.html.
const PENDING_KEY = 'osm-auth-pending'
const ANSWER_KEY = 'osm-auth-answer'
const CHANNEL = 'osm-auth'

export interface OsmUser {
  token: string
  /** The OSM name, once known. */
  name: string | null
}

/** The person closed OSM's sign-in, or said no there. */
export class SignInCancelled extends Error {}

function storedUser(): OsmUser | null {
  try {
    const stored = JSON.parse(localStorage.getItem(USER_KEY) ?? 'null')
    return typeof stored?.token === 'string' ? stored : null
  } catch {
    return null
  }
}

let user = storedUser()
const listeners = new Set<() => void>()

export function subscribeOsmUser(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const osmUser = (): OsmUser | null => user

function setUser(next: OsmUser | null): void {
  user = next
  try {
    if (next) localStorage.setItem(USER_KEY, JSON.stringify(next))
    else localStorage.removeItem(USER_KEY)
  } catch {
    // Signed in for this visit only.
  }
  for (const listener of listeners) listener()
}

/** The API, as whoever is signed in. */
export const osm = osmApi({
  url: OSM_API,
  token: () => user?.token ?? null,
  changesetTags: () => ({
    created_by: REGION.osm.createdBy,
    hashtags: REGION.osm.hashtag,
    host: new URL(import.meta.env.BASE_URL, window.location.href).href,
  }),
  onUnauthorized: () => setUser(null),
})

/** Registered with the OAuth app on OSM: it must match exactly. */
const redirectUri = (): string => new URL('land.html', new URL(import.meta.env.BASE_URL, window.location.href)).href

const base64url = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const random = (size: number): string => base64url(crypto.getRandomValues(new Uint8Array(size)))

async function challenge(verifier: string): Promise<string> {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
}

const installed = (): boolean =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/**
 * Signs in. Call it straight from a click, so the popup is let through.
 * Resolves once signed in. Rejects with SignInCancelled when OSM is told no,
 * or another sign-in starts: the map cannot see the popup closed. Where it
 * goes to OSM and back instead, the page leaves.
 */
export async function signIn(): Promise<void> {
  if (!OSM_CLIENT_ID) throw new Error('No OSM app to sign in with')
  try {
    // A sign-in left half done would send the popup's answer back to the map in the popup.
    sessionStorage.removeItem(PENDING_KEY)
  } catch {
    // Nothing kept, nothing to clear.
  }
  const popup = installed() ? null : window.open('', 'osm-sign-in', 'popup,width=560,height=700')
  const verifier = random(32)
  const state = random(16)
  const url = `${OSM_URL}/oauth2/authorize?${new URLSearchParams({
    client_id: OSM_CLIENT_ID,
    redirect_uri: redirectUri(),
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: await challenge(verifier),
    code_challenge_method: 'S256',
  })}`
  if (!popup) {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify({ state, verifier, back: window.location.href }))
    window.location.assign(url)
    return new Promise(() => {})
  }
  const answer = popupAnswer(state)
  popup.location.href = url
  await finish(await answer, verifier)
}

/** Ends the sign-in waiting for its popup, when another starts. */
let stopWaiting: (() => void) | null = null

/**
 * What land.html in the popup hands back for this sign-in. OSM's pages cut the
 * popup off from the map (Cross-Origin-Opener-Policy): the map can neither see
 * it nor close it, so the answer comes over a BroadcastChannel and the popup
 * closes itself.
 */
function popupAnswer(state: string): Promise<URLSearchParams> {
  stopWaiting?.()
  return new Promise((resolve, reject) => {
    const channel = new BroadcastChannel(CHANNEL)
    const end = () => {
      channel.close()
      stopWaiting = null
    }
    stopWaiting = () => {
      end()
      reject(new SignInCancelled())
    }
    channel.onmessage = (event) => {
      const answer = new URLSearchParams(String(event.data))
      if (answer.get('state') !== state) return
      end()
      resolve(answer)
    }
  })
}

/** Trades OSM's answer for a token, then asks for the person's name. */
async function finish(answer: URLSearchParams, verifier: string): Promise<void> {
  const code = answer.get('code')
  if (!code || !OSM_CLIENT_ID) {
    if (answer.get('error') === 'access_denied') throw new SignInCancelled()
    throw new Error(answer.get('error_description') ?? answer.get('error') ?? 'OSM gave no code')
  }
  const res = await fetch(`${OSM_URL}/oauth2/token`, {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri(),
      client_id: OSM_CLIENT_ID,
      code_verifier: verifier,
    }),
  })
  if (!res.ok) {
    // OAuth errors say why: an app marked confidential, for one, wants a secret the site never has.
    const body: { error?: string; error_description?: string } = await res.json().catch(() => ({}))
    throw new Error(body.error_description ?? body.error ?? `OSM token: ${res.status}`)
  }
  const { access_token: token }: { access_token: string } = await res.json()
  setUser({ token, name: null })
  const details = await fetch(`${OSM_API}/user/details.json`, { headers: { Authorization: `Bearer ${token}` } })
  if (details.ok) {
    const data: { user: { display_name: string } } = await details.json()
    if (user?.token === token) setUser({ token, name: data.user.display_name })
  }
}

/** Finishes a sign-in that went to OSM and came back to this page. Run once, as the app starts. */
export function resumeSignIn(): void {
  let pending: string | null
  let answer: string | null
  try {
    pending = sessionStorage.getItem(PENDING_KEY)
    answer = sessionStorage.getItem(ANSWER_KEY)
    sessionStorage.removeItem(PENDING_KEY)
    sessionStorage.removeItem(ANSWER_KEY)
  } catch {
    return
  }
  if (!pending || answer === null) return
  const { state, verifier }: { state: string; verifier: string } = JSON.parse(pending)
  const query = new URLSearchParams(answer)
  if (query.get('state') === state) finish(query, verifier).catch(() => undefined)
}

export function signOut(): void {
  const token = user?.token
  setUser(null)
  // OSM forgets it too.
  if (token && OSM_CLIENT_ID) {
    fetch(`${OSM_URL}/oauth2/revoke`, {
      method: 'POST',
      body: new URLSearchParams({ token, client_id: OSM_CLIENT_ID }),
    }).catch(() => undefined)
  }
}
