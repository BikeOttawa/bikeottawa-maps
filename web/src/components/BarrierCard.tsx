import { useEffect, useState } from 'react'
import { isMessageKey, type MessageKey, useI18n } from '../i18n'
import { OsmTags } from './OsmTags'
import { CardPhoto } from './PlacePhoto'
import { StopIcon } from './StopIcon'

/** OSM `barrier` values with a name of their own; any other is a barrier. */
const NAMED = new Set([
  'bollard',
  'cycle_barrier',
  'gate',
  'lift_gate',
  'swing_gate',
  'block',
  'jersey_barrier',
  'kerb',
  'stile',
  'kissing_gate',
  'turnstile',
  'chain',
])

/** What getting a bike past it is like, for kinds that pass alike. */
const NOTES: Record<string, MessageKey> = {
  bollard: 'barrierNote.bollard',
  cycle_barrier: 'barrierNote.cycle_barrier',
  gate: 'barrierNote.gate',
  lift_gate: 'barrierNote.gate',
  swing_gate: 'barrierNote.gate',
  block: 'barrierNote.block',
  jersey_barrier: 'barrierNote.block',
  kerb: 'barrierNote.kerb',
  stile: 'barrierNote.foot',
  kissing_gate: 'barrierNote.foot',
  turnstile: 'barrierNote.foot',
  chain: 'barrierNote.chain',
}

/** The name of a barrier, from its OSM value (`kerb` for a raised kerb). */
export function barrierLabel(value: string): MessageKey {
  return (NAMED.has(value) ? `barrier.${value}` : 'barrier.other') as MessageKey
}

/** The OSM node of a barrier: its id and tags. */
interface BarrierNode {
  id: number
  tags: Record<string, string>
}

/** How far around the route's point the barrier's node is looked for, in degrees: a few metres. */
const LOOK_AROUND = 0.00004

/**
 * The barrier's node in OSM, looked up once the card opens: the router gives
 * only where it is and its kind, so the OSM API is asked for what is mapped
 * within a few metres (one small request), and the nearest barrier of that
 * kind taken. Null while loading, 'none' when not found.
 */
function useBarrierNode(at: [number, number], barrier: string): BarrierNode | 'none' | null {
  const [lon, lat] = at
  const [node, setNode] = useState<BarrierNode | 'none' | null>(null)
  useEffect(() => {
    setNode(null)
    const controller = new AbortController()
    const d = LOOK_AROUND
    fetch(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${lon - d},${lat - d},${lon + d},${lat + d}`, {
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`OSM API: ${res.status}`)
        return res.json()
      })
      .then(
        (data: {
          elements?: { type: string; id: number; lat?: number; lon?: number; tags?: Record<string, string> }[]
        }) => {
          const isIt = (tags: Record<string, string>) => (barrier === 'kerb' ? tags.kerb === 'raised' : tags.barrier)
          const [best] = (data.elements ?? [])
            .filter((e) => e.type === 'node' && e.tags && isIt(e.tags))
            .map((e) => ({
              e,
              // Its own kind first, then the closest.
              score: Math.hypot((e.lon ?? 0) - lon, (e.lat ?? 0) - lat) + (e.tags?.barrier === barrier ? 0 : 1),
            }))
            .sort((a, b) => a.score - b.score)
          setNode(best ? { id: best.e.id, tags: best.e.tags ?? {} } : 'none')
        },
      )
      .catch(() => {
        if (!controller.signal.aborted) setNode('none')
      })
    return () => controller.abort()
  }, [lon, lat, barrier])
  return node
}

/** A width tag as metres, or as written when it has units of its own. */
function metres(value: string | undefined, locale: string): string | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? `${n.toLocaleString(locale)} m` : value
}

/**
 * A barrier on the route: what it is, what getting a bike past it is like,
 * what its OSM tags say (bikes allowed, the gap, fixed or not, locked), photos
 * taken nearby, and a link to it in the OSM editor.
 */
export function BarrierCard({ barrier, at, onClose }: { barrier: string; at: [number, number]; onClose: () => void }) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const [lon, lat] = at
  const node = useBarrierNode(at, barrier)
  const tags = node && node !== 'none' ? node.tags : {}
  const label = (key: string) => (isMessageKey(key) ? t(key) : null)
  const bikes = { yes: 'yes', designated: 'yes', permissive: 'yes', no: 'no', dismount: 'dismount' }[tags.bicycle ?? '']
  const facts = [
    { label: t('barrierFact.bikes'), value: bikes ? label(`barrierBikes.${bikes}`) : null },
    { label: t('barrierFact.gap'), value: metres(tags['maxwidth:physical'] ?? tags.maxwidth ?? tags.width, locale) },
    { label: t('barrierFact.kind'), value: tags.bollard ? label(`bollard.${tags.bollard}`) : null },
    { label: t('barrierFact.locked'), value: tags.locked ? label(tags.locked === 'yes' ? 'yes' : 'no') : null },
    { label: t('barrierFact.note'), value: tags.description ?? tags.note ?? null },
  ].filter((fact) => fact.value)
  const edit =
    node && node !== 'none'
      ? `https://www.openstreetmap.org/edit?node=${node.id}`
      : `https://www.openstreetmap.org/edit#map=20/${lat}/${lon}`
  return (
    <section className="feature-card" aria-live="polite">
      <header>
        <StopIcon kind="barrier" />
        <div className="feature-title">
          <h2>{t(barrierLabel(barrier))}</h2>
          <p>{t('barrierOnRoute')}</p>
        </div>
        <button type="button" className="feature-close" aria-label={t('close')} onClick={onClose}>
          <svg
            aria-hidden="true"
            width="14"
            height="14"
            viewBox="0 0 18 18"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.4"
            strokeLinecap="round"
          >
            <path d="M4 4l10 10M14 4L4 14" />
          </svg>
        </button>
      </header>
      <CardPhoto at={at} />
      <p className="construction-message">{t(NOTES[barrier] ?? 'barriersHint')}</p>
      {node === null && <p className="footnote">{t('loading')}</p>}
      {facts.length > 0 && (
        <dl>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {node && node !== 'none' && <OsmTags key={node.id} path={`node/${node.id}`} />}
      <p className="feature-links">
        <a href={edit} target="_blank" rel="noopener noreferrer">
          {t('editInOsm')}
        </a>
      </p>
    </section>
  )
}
