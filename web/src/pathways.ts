import type { ExpressionSpecification, FilterSpecification } from 'maplibre-gl'

/**
 * The pathways layer: every path bikes are not kept off, coloured by surface or
 * by width, those not yet tagged with either in yellow so they can be mapped.
 * The pipeline groups surfaces (`surface_group`) and reads widths (`width_m`).
 */

/** Surface groups, smoothest first; unknown is a path whose surface is not tagged. */
export const SURFACE_IDS = ['paved', 'stone_dust', 'gravel', 'dirt', 'unknown'] as const
export type SurfaceId = (typeof SURFACE_IDS)[number]
export type KnownSurfaceId = Exclude<SurfaceId, 'unknown'>

export const COLOR_BY = ['surface', 'width'] as const
export type ColorBy = (typeof COLOR_BY)[number]

export interface PathwayFilters {
  /** The pathways are drawn at all. */
  show: boolean
  by: ColorBy
  surfaces: readonly SurfaceId[]
  /** Only pathways at least this wide, in metres; 0 for any width. */
  minWidth: number
  /** Pathways whose width is not tagged stay on the map. */
  unknownWidth: boolean
}

export const DEFAULT_PATHWAY_FILTERS: PathwayFilters = {
  show: true,
  by: 'surface',
  surfaces: SURFACE_IDS,
  minWidth: 0,
  unknownWidth: true,
}

/** The width slider, in metres. */
export const WIDTH_RANGE = { max: 4, step: 0.5 }

/** Width a pathway is drawn at when its width is not tagged. */
export const UNKNOWN_WIDTH = 1.5

/** Widths the colours change at, narrowest first. */
export const WIDTH_STOPS = [1, 2, 3, 4] as const

/** Km of pathway, written by the pipeline into tiles/meta.json. */
export interface PathwayKm {
  km: number
  surface: Record<SurfaceId, number>
  unknownWidth: number
}

const surfaceOf: ExpressionSpecification = ['coalesce', ['get', 'surface_group'], 'unknown']

/** Which pathways the filters let through. */
export function pathwayFilter(f: PathwayFilters): FilterSpecification {
  return [
    'all',
    ['has', 'pathway'],
    ['in', surfaceOf, ['literal', [...f.surfaces]]],
    ['case', ['has', 'width_m'], ['>=', ['get', 'width_m'], f.minWidth], f.unknownWidth],
  ]
}

const isColorBy = (value: string): value is ColorBy => COLOR_BY.includes(value as ColorBy)
const isSurfaceId = (value: string): value is SurfaceId => SURFACE_IDS.includes(value as SurfaceId)

/**
 * In the URL as `pathways=width;paved,gravel;2.5;known;off`: colour, surfaces,
 * least width, `known` to leave out unknown widths and `off` to hide them all,
 * each part left out when it is the default.
 */
export function formatPathwayFilters(f: PathwayFilters): string | null {
  const d = DEFAULT_PATHWAY_FILTERS
  const allSurfaces = f.surfaces.length === d.surfaces.length && d.surfaces.every((s) => f.surfaces.includes(s))
  const parts = [
    f.by === d.by ? '' : f.by,
    allSurfaces ? '' : SURFACE_IDS.filter((s) => f.surfaces.includes(s)).join(',') || 'none',
    f.minWidth === d.minWidth ? '' : String(f.minWidth),
    f.unknownWidth ? '' : 'known',
    f.show ? '' : 'off',
  ]
  return parts.some(Boolean) ? parts.join(';').replace(/;+$/, '') : null
}

export function parsePathwayFilters(text: string | undefined): PathwayFilters {
  const d = DEFAULT_PATHWAY_FILTERS
  const [byText = '', surfaceText = '', widthText = '', unknownText = '', showText = ''] = (text ?? '').split(';')
  const width = Number(widthText)
  const inRange = widthText !== '' && width >= 0 && width <= WIDTH_RANGE.max
  return {
    show: showText !== 'off',
    by: isColorBy(byText) ? byText : d.by,
    surfaces: surfaceText === 'none' ? [] : surfaceText ? surfaceText.split(',').filter(isSurfaceId) : d.surfaces,
    minWidth: inRange ? Math.round(width / WIDTH_RANGE.step) * WIDTH_RANGE.step : d.minWidth,
    unknownWidth: unknownText !== 'known',
  }
}
