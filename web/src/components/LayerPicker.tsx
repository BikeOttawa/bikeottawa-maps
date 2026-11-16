import { useEffect, useRef } from 'react'
import { useI18n } from '../i18n'
import { LAYER_IDS, type LayerId, LTS_COLORS, pathwayColors } from '../layers'
import { GROUP_COLORS } from '../places'
import { BarricadeIcon } from './OverlayIcons'

interface Props {
  active: LayerId
  onChange: (layer: LayerId) => void
}

/** A small picture of what each layer shows, in the colours it uses on the map. */
function LayerIcon({ layer }: { layer: LayerId }) {
  const common = { width: 26, height: 26, viewBox: '0 0 24 24', fill: 'none' } as const
  if (layer === 'comfort') {
    // Streets in the four stress colours.
    return (
      <svg aria-hidden="true" {...common} strokeWidth="3.2" strokeLinecap="round">
        <path d="M3 5h18" stroke={LTS_COLORS[0]} />
        <path d="M3 10h14" stroke={LTS_COLORS[1]} />
        <path d="M3 15h18" stroke={LTS_COLORS[2]} />
        <path d="M3 20h10" stroke={LTS_COLORS[3]} />
      </svg>
    )
  }
  if (layer === 'pathways') {
    // A winding path, paved where it is known and yellow where it is not yet.
    const colors = pathwayColors('light')
    return (
      <svg aria-hidden="true" {...common} strokeWidth="3" strokeLinecap="round">
        <path d="M5 22c0-5 9-4 9-9" stroke={colors.surface.asphalt} />
        <path d="M14 13c0-5-7-5-5-11" stroke={colors.unknown} />
      </svg>
    )
  }
  if (layer === 'collisions') {
    // A warning sign in the colours of the injuries.
    return (
      <svg aria-hidden="true" {...common}>
        <path d="M12 3 2.5 20h19Z" fill="#E2603A" stroke="#BC2F1F" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M12 9.5v5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="12" cy="17.3" r="1.2" fill="#fff" />
      </svg>
    )
  }
  if (layer === 'construction') {
    // A road-closed barricade, as on the map.
    return <BarricadeIcon size={26} />
  }
  if (layer === 'thefts') {
    // An open padlock, its shackle pulled free.
    return (
      <svg aria-hidden="true" {...common} strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 11V7.5a4 4 0 0 1 7.6-1.7" stroke="#7A3E9D" strokeWidth="2.2" />
        <rect x="5" y="11" width="14" height="10" rx="2" fill="#7A3E9D" />
        <circle cx="12" cy="15.5" r="1.4" fill="#fff" />
        <path d="M12 16.5v2" stroke="#fff" strokeWidth="1.6" />
      </svg>
    )
  }
  return (
    <svg
      aria-hidden="true"
      {...common}
      stroke={GROUP_COLORS.food}
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21.5s7-6.4 7-11.5a7 7 0 1 0-14 0c0 5.1 7 11.5 7 11.5Z" />
      <circle cx="12" cy="10" r="2.6" />
    </svg>
  )
}

export function LayerPicker({ active, onChange }: Props) {
  const { t } = useI18n()
  // On a phone the row scrolls sideways: keep the layer on show in view.
  const activeButton = useRef<HTMLButtonElement>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: scrolls when the layer changes
  useEffect(() => {
    activeButton.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [active])
  return (
    <fieldset className="layer-picker">
      <legend className="visually-hidden">{t('layers')}</legend>
      {LAYER_IDS.map((id) => (
        <button
          key={id}
          ref={id === active ? activeButton : undefined}
          type="button"
          className="layer-button"
          aria-pressed={id === active}
          title={t(`layer.${id}.desc`)}
          onClick={() => onChange(id)}
        >
          <span className="layer-icon">
            <LayerIcon layer={id} />
          </span>
          <span className="layer-label">{t(`layer.${id}`)}</span>
        </button>
      ))}
    </fieldset>
  )
}
