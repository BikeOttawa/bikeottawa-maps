/** Types for the web app, which rates the stretches of a route with the same model. */
export function evaluateLTS(way: { tags: Record<string, string> }): { lts: number; message: string[]; rule?: string }
