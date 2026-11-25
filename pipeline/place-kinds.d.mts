/** Types for the web app, which tags the places added from it with the same rows. */
export type PlaceKindRow = readonly [
  key: string,
  value: string,
  kind: string,
  minzoom: number,
  needs?: 'named' | 'sight' | 'usefulStore' | 'bikeRamp',
]

export const PLACE_KINDS: readonly PlaceKindRow[]
