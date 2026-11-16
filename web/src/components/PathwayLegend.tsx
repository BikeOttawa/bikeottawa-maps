import type { CSSProperties } from 'react'
import { useI18n } from '../i18n'
import { type BasemapId, pathwayColors, widthGradient } from '../layers'
import {
  COLOR_BY,
  formatLength,
  LENGTH_STEPS,
  type PathwayFilters,
  type PathwayKm,
  SURFACE_IDS,
  type SurfaceId,
  WIDTH_RANGE,
} from '../pathways'

interface Props {
  filters: PathwayFilters
  onChange: (filters: PathwayFilters) => void
  /** Km of pathway of each kind, from the pipeline; null when not known. */
  km: PathwayKm | null
  basemap: BasemapId
}

/**
 * The pathways layer's key and filters: what to colour them by, which surfaces
 * and how wide. Swatches show only for what the colours stand for, so yellow
 * always means one thing.
 */
export function PathwayLegend({ filters, onChange, km, basemap }: Props) {
  const { t, lang } = useI18n()
  const locale = lang === 'fr' ? 'fr-CA' : 'en-CA'
  const colors = pathwayColors(basemap)
  const bySurface = filters.by === 'surface'
  const distance = (n: number | undefined) =>
    km && n !== undefined && <span className="share">{`${n.toLocaleString(locale)} km`}</span>
  const metres = (n: number) => `${n.toLocaleString(locale, { maximumFractionDigits: 1 })} m`
  const toggle = (surface: SurfaceId) =>
    onChange({
      ...filters,
      surfaces: filters.surfaces.includes(surface)
        ? filters.surfaces.filter((s) => s !== surface)
        : [...filters.surfaces, surface],
    })
  const surfaceColor = (surface: SurfaceId) => (surface === 'unknown' ? colors.unknown : colors.surface[surface])
  const atLeast = (value: number, text: string) =>
    value ? t('pathways.atLeast').replace('{value}', text) : t('pathways.any')
  const width = atLeast(filters.minWidth, metres(filters.minWidth))
  const length = atLeast(filters.minLength, formatLength(filters.minLength, locale))

  return (
    <div className="pathway-legend">
      <fieldset className="pathway-group">
        <legend>{t('pathways.colorBy')}</legend>
        <div className="mode-switch">
          {COLOR_BY.map((by) => (
            <button
              key={by}
              type="button"
              aria-pressed={by === filters.by}
              onClick={() => onChange({ ...filters, by })}
            >
              {t(`pathways.by.${by}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset className="pathway-group">
        <legend>{t('pathways.by.surface')}</legend>
        {SURFACE_IDS.map((surface) => (
          <label key={surface} className="check">
            <input type="checkbox" checked={filters.surfaces.includes(surface)} onChange={() => toggle(surface)} />
            <span
              className="swatch line"
              style={{ background: surfaceColor(surface), visibility: bySurface ? undefined : 'hidden' }}
            />
            <span>{t(`surface.${surface}`)}</span>
            {distance(km?.surface[surface])}
          </label>
        ))}
      </fieldset>
      <fieldset className="pathway-group">
        <legend>
          {t('pathways.by.width')}
          {t('colon')}
          {width}
        </legend>
        <input
          className="pathway-range"
          type="range"
          min={0}
          max={WIDTH_RANGE.max}
          step={WIDTH_RANGE.step}
          value={filters.minWidth}
          aria-label={t('pathways.by.width')}
          aria-valuetext={width}
          style={bySurface ? undefined : ({ '--track': widthGradient(basemap) } as CSSProperties)}
          onChange={(e) => onChange({ ...filters, minWidth: Number(e.target.value) })}
        />
        {!bySurface && (
          <span className="pathway-ramp" aria-hidden="true">
            <span>{t('pathways.narrow')}</span>
            <span>{t('pathways.wide')}</span>
          </span>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={filters.unknownWidth}
            onChange={() => onChange({ ...filters, unknownWidth: !filters.unknownWidth })}
          />
          <span
            className="swatch line"
            style={{ background: colors.unknown, visibility: bySurface ? 'hidden' : undefined }}
          />
          <span>{t('pathways.unknownWidth')}</span>
          {distance(km?.unknownWidth)}
        </label>
      </fieldset>
      <fieldset className="pathway-group">
        <legend>
          {t('pathways.length')}
          {t('colon')}
          {length}
        </legend>
        <input
          className="pathway-range"
          type="range"
          min={0}
          max={LENGTH_STEPS.length - 1}
          step={1}
          value={Math.max(0, LENGTH_STEPS.indexOf(filters.minLength as (typeof LENGTH_STEPS)[number]))}
          aria-label={t('pathways.length')}
          aria-valuetext={length}
          onChange={(e) => onChange({ ...filters, minLength: LENGTH_STEPS[Number(e.target.value)] })}
        />
        <span className="pathway-note">{t('pathways.lengthNote')}</span>
      </fieldset>
      <p className="footnote">{t('pathways.hint')}</p>
    </div>
  )
}
