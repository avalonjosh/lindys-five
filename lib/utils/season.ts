// Season-string helpers. NHL seasons are 8-digit strings like "20252026".
// Centralized so titles, metadata, JSON-LD, and fetches stay in sync across the
// year rollover instead of hardcoding "2025-26" in dozens of places.

// Current NHL season as an 8-digit string (e.g. "20252026").
// Sept-Dec belong to the season starting that year; Jan-Aug to the prior year's.
export function getCurrentNHLSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  if (month >= 8) return `${year}${year + 1}`;
  return `${year - 1}${year}`;
}

// "20252026" -> "2025-26"
export function formatSeasonLabel(season: string): string {
  const start = season.slice(0, 4);
  const end = season.slice(6, 8);
  return `${start}-${end}`;
}

// "20252026" -> "2025"
export function formatSeasonStartYear(season: string): string {
  return season.slice(0, 4);
}

// "20252026" -> "2026"
export function formatSeasonEndYear(season: string): string {
  return season.slice(4, 8);
}

// "20252026" -> "20262027"
export function nextNHLSeason(season: string): string {
  const start = parseInt(season.slice(0, 4), 10) + 1;
  return `${start}${start + 1}`;
}

// "20262027" -> "20252026"
export function previousNHLSeason(season: string): string {
  const start = parseInt(season.slice(0, 4), 10) - 1;
  return `${start}${start + 1}`;
}

// Regular-season game count. The NHL's 2025 CBA expanded the schedule to 84
// games starting with the 2026-27 season (start year 2026); prior seasons are 82.
export function getRegularSeasonGameCount(season: string): number {
  return parseInt(season.slice(0, 4), 10) >= 2026 ? 84 : 82;
}
