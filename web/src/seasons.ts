/** Seasons as the map counts them, by month: winter is December to February. */
export const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const

const SEASON_OF_MONTH = [
  'winter',
  'winter',
  'spring',
  'spring',
  'spring',
  'summer',
  'summer',
  'summer',
  'fall',
  'fall',
  'fall',
  'winter',
] as const

/** The season of a date written YYYY-MM-DD. */
export function seasonOf(date: string): string {
  return SEASON_OF_MONTH[Number(date.slice(5, 7)) - 1] ?? 'other'
}
