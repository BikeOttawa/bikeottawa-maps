// Helpers for fetch-construction.mjs: the City of Ottawa's construction
// forecast, its project types sorted into a few kinds and its timing into
// when the work happens.

/** The City's project type codes, by the kind of work the map sorts them into. */
const KIND_OF = {
  cycling: ['MCR', 'MMUP', 'ORP', 'MS', 'RSC', 'STRENEW'],
  roads: ['RRR', 'RRSW', 'RCSW', 'RGRU', 'GNR', 'MIM', 'MRA', 'MNM', 'MTSI', 'MATM', 'MTS', 'RSS', 'RHML'],
  water: [
    'RS',
    'RSL',
    'RSNI',
    'RWM',
    'RWML',
    'RWCP',
    'GNSP',
    'GNWP',
    'SWM',
    'RSICDI',
    'RFOC',
    'RSPS',
    'RWPS',
    'GNSPS',
    'GNWPS',
  ],
  bridges: ['SBR', 'SBMR', 'SBRS', 'SCR', 'GNRS', 'SRWR', 'SNBR', 'SSI'],
  transit: ['GNT', 'GNTPR', 'GNTS', 'MTP', 'MTPL', 'RTS', 'TTPR', 'TTR', 'STSM', 'TTSR', 'LRT'],
}

/** Cycling and walking, roads, sewers and water, bridges and culverts, transit; buildings, parks and the rest are other. */
export function kindOf(code) {
  for (const [kind, codes] of Object.entries(KIND_OF)) if (codes.includes(code)) return kind
  return 'other'
}

const STARTS = { 'This Year': 'thisYear', '1-2 Years': 'soon', '2-3 Years': 'later' }

/** Under way now, or starting this year, in one to two years or in two to three. */
export function timingOf(status, start) {
  if (status === 'INPROGRESS') return 'now'
  return STARTS[start] ?? 'later'
}

/** Statuses of work that is not going ahead: the map leaves these out. */
export const NOT_HAPPENING = ['CANCELLED', 'ON_HOLD', 'BUILT', 'STUDY_ONLY', 'BELOW_CUT']

/** A field's coded values, as a map from code to name, from a layer's description. */
export function codedValues(layer, field) {
  const values = layer.fields?.find((f) => f.name === field)?.domain?.codedValues ?? []
  return new Map(values.map((v) => [v.code, v.name.replace(/\s+/g, ' ').trim()]))
}

/** "None", "N/A" and the like are no traffic impact to show. */
export function impactsText(text) {
  const clean = String(text ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return /^(none\.?|n\/a|no|not applicable|na|-)?$/i.test(clean) ? undefined : clean
}
