/** MLB season year for display/metadata (Eastern). Jan-Feb belongs to the upcoming season. */
export function mlbSeasonYear(): number {
  return Number(new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York', year: 'numeric' }));
}
