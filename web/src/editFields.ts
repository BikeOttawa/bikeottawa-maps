import { PLACE_KINDS as KIND_TAGS } from '../../pipeline/place-kinds.mjs'
import { type MessageKey, translator } from './i18n'
import { isPlaceKind, type PlaceKind } from './places'

/**
 * What cards let people set in OSM: a few common tags for each kind of
 * feature, picked from lists, and for places a note. Kinds left out get OSM
 * notes only.
 */

/** A tag a card lets people set, and the values it offers. */
export interface TagField {
  key: string
  label: MessageKey
  values: readonly string[]
  /** Where each value's name is in the messages, before the value: `tag.<key>.` names it on the card too. */
  names?: string
  /** For numbers: the unit they are shown with, '' for none. */
  unit?: string
  /** Typed rather than picked, with this hint in the empty box. */
  hint?: MessageKey
}

/** What the lists cannot say, in words, for mappers to turn into tags: "closed on Sundays". */
const NOTE: TagField = { key: 'note', label: 'fact.note', values: [], hint: 'fact.note.hint' }

/** What people may set on a kind of feature, and what it is called in changeset comments ("pathways"). */
export interface EditKind {
  fields: readonly TagField[]
  thing: string
}

const yesNo = (key: string, label: MessageKey): TagField => ({ key, label, names: '', values: ['yes', 'no'] })
const numbers = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, i) => String(from + i))

const SURFACE: TagField = {
  key: 'surface',
  label: 'pathways.surface',
  names: 'tag.surface.',
  values: ['asphalt', 'concrete', 'paving_stones', 'compacted', 'fine_gravel', 'gravel', 'ground', 'grass', 'wood'],
}
const SMOOTHNESS: TagField = {
  key: 'smoothness',
  label: 'pathways.smoothness',
  names: 'tag.smoothness.',
  values: ['excellent', 'good', 'intermediate', 'bad', 'very_bad', 'horrible'],
}
const LIT = yesNo('lit', 'pathways.lit')
const FEE = yesNo('fee', 'fact.fee')
const COVERED = yesNo('covered', 'fact.covered')
const SEASONAL = yesNo('seasonal', 'fact.seasonal')
const WHEELCHAIR: TagField = {
  key: 'wheelchair',
  label: 'fact.wheelchair',
  names: '',
  values: ['yes', 'limited', 'no'],
}
const MATERIAL: TagField = {
  key: 'material',
  label: 'fact.material',
  names: 'tag.material.',
  values: ['wood', 'metal', 'concrete', 'stone', 'plastic'],
}

/** What pathways are filtered by, so the yellow, untagged ones can be filled in. */
export const PATHWAY_FIELDS: readonly TagField[] = [
  SURFACE,
  { key: 'width', label: 'pathways.width', unit: 'm', values: ['1', '1.5', '2', '2.5', '3', '3.5', '4', '5'] },
  SMOOTHNESS,
  LIT,
  { key: 'winter_service', label: 'pathways.snow', names: 'winter.', values: ['yes', 'no'] },
]

/** What the comfort layer and its filters read. */
const STREET_FIELDS: readonly TagField[] = [
  {
    key: 'maxspeed',
    label: 'fact.maxspeed',
    unit: 'km/h',
    values: ['20', '30', '40', '50', '60', '70', '80', '90', '100'],
  },
  { key: 'lanes', label: 'fact.lanes', unit: '', values: numbers(1, 6) },
  SURFACE,
  SMOOTHNESS,
  LIT,
]

const FOOD: readonly TagField[] = [
  yesNo('outdoor_seating', 'fact.outdoor_seating'),
  yesNo('takeaway', 'fact.takeaway'),
  WHEELCHAIR,
]

/** Places by kind (see places.ts). */
const PLACES: Partial<Record<PlaceKind, EditKind>> = {
  parking: {
    thing: 'bike parking',
    fields: [
      {
        key: 'bicycle_parking',
        label: 'fact.bicycle_parking',
        names: 'tag.bicycle_parking.',
        values: ['stands', 'bollard', 'wall_loops', 'rack', 'shed', 'lockers', 'building'],
      },
      {
        key: 'capacity',
        label: 'fact.capacity',
        unit: '',
        values: [...numbers(1, 12), '15', '20', '25', '30', '40', '50'],
      },
      COVERED,
    ],
  },
  shop: {
    thing: 'bike shops',
    fields: [
      yesNo('service:bicycle:repair', 'fact.service:bicycle:repair'),
      yesNo('service:bicycle:rental', 'fact.service:bicycle:rental'),
      WHEELCHAIR,
    ],
  },
  repair: {
    thing: 'repair stations',
    fields: [
      yesNo('service:bicycle:pump', 'fact.service:bicycle:pump'),
      yesNo('service:bicycle:tools', 'fact.service:bicycle:tools'),
      yesNo('service:bicycle:chain_tool', 'fact.service:bicycle:chain_tool'),
    ],
  },
  air: { thing: 'air pumps', fields: [FEE] },
  water: { thing: 'drinking fountains', fields: [yesNo('bottle', 'fact.bottle'), SEASONAL] },
  toilets: {
    thing: 'toilets',
    fields: [FEE, WHEELCHAIR, SEASONAL, yesNo('changing_table', 'fact.changing_table')],
  },
  bench: { thing: 'benches', fields: [yesNo('backrest', 'fact.backrest'), MATERIAL] },
  picnic: { thing: 'picnic tables', fields: [COVERED, MATERIAL] },
  bbq: {
    thing: 'barbecues',
    fields: [
      { key: 'fuel', label: 'fact.fuel', names: 'tag.fuel.', values: ['charcoal', 'wood', 'gas', 'electric'] },
      COVERED,
    ],
  },
  information: {
    thing: 'information points',
    fields: [
      {
        key: 'information',
        label: 'fact.information',
        names: 'tag.information.',
        values: ['board', 'map', 'guidepost', 'office'],
      },
    ],
  },
  cafe: { thing: 'cafes', fields: FOOD },
  restaurant: { thing: 'restaurants', fields: FOOD },
  fast_food: { thing: 'fast food places', fields: FOOD },
  ice_cream: { thing: 'ice cream places', fields: FOOD },
  pub: { thing: 'pubs', fields: FOOD },
  brewery: { thing: 'breweries', fields: FOOD },
  bakery: { thing: 'bakeries', fields: FOOD },
  grocery: { thing: 'shops', fields: [WHEELCHAIR] },
  convenience: { thing: 'shops', fields: [WHEELCHAIR] },
  general: { thing: 'shops', fields: [WHEELCHAIR] },
  pharmacy: { thing: 'pharmacies', fields: [WHEELCHAIR] },
}

/** What a place is called in changeset comments, when its kind has no name there of its own: "viewpoint". */
export const placeThing = (kind: PlaceKind): string => translator('en')(`place.${kind}`).toLowerCase()

/** What a card lets people set: by the way's kind, or the place's, with a note on every place. */
export function editKind(feature: 'way' | 'place', props: Record<string, unknown>): EditKind | null {
  if (feature === 'place') {
    if (!isPlaceKind(props.kind)) return null
    const own = PLACES[props.kind]
    return { thing: own?.thing ?? placeThing(props.kind), fields: [...(own?.fields ?? []), NOTE] }
  }
  if (props.pathway === true) return { thing: 'pathways', fields: PATHWAY_FIELDS }
  if (props.kind === 'path') return { thing: 'paths', fields: PATHWAY_FIELDS }
  if (props.kind === 'street') return { thing: 'streets', fields: STREET_FIELDS }
  return null
}

/**
 * The tag that makes a new place that kind on the map: the first the tiles
 * read it from (pipeline/place-kinds.mjs) that needs nothing more, or only a
 * name when it has one. An unnamed beach is a swimming area, a named one a beach.
 */
export function kindTag(kind: PlaceKind, named: boolean): Record<string, string> {
  const row = KIND_TAGS.find(([, , of, , needs]) => of === kind && (!needs || (needs === 'named' && named)))
  return row ? { [row[0]]: row[1] } : {}
}

/** A new place's tags: those of its kind, its name, then the details picked. */
export function newPlaceTags(kind: PlaceKind, name: string, picks: Record<string, string>): Record<string, string> {
  const named = name.trim()
  return {
    ...kindTag(kind, named !== ''),
    ...(named && { name: named }),
    ...Object.fromEntries(
      Object.entries(picks)
        .map(([key, value]) => [key, value.trim()])
        .filter(([, value]) => value !== ''),
    ),
  }
}

/** A field's values for a feature: its own value first when the list lacks it, so saving never changes it unseen. */
export function fieldValues(field: TagField, current: string | undefined): string[] {
  return current === undefined || field.values.includes(current) ? [...field.values] : [current, ...field.values]
}

/** All of them, for the tests. */
export const EDIT_KINDS: readonly EditKind[] = [
  { thing: 'pathways', fields: PATHWAY_FIELDS },
  { thing: 'streets', fields: STREET_FIELDS },
  ...Object.values(PLACES).filter((kind) => kind !== undefined),
]
