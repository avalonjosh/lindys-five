/**
 * Franchise logo / brand-color lookups for the Perfect Season game. Kept in lib
 * (not the UI helpers) so both client components and the edge OG route can use
 * them. Logos are modern, not era-correct, by design.
 */

import type { Sport } from './types';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';

// Lahman franchID to the modern MLB Stats team id (used for the logo URL).
const MLB_FRANCHISE_ID: Record<string, number> = {
  ANA: 108, ARI: 109, ATL: 144, BAL: 110, BOS: 111, CHC: 112, CHW: 145, CIN: 113, CLE: 114,
  COL: 115, DET: 116, FLA: 146, HOU: 117, KCR: 118, LAD: 119, MIL: 158, MIN: 142, NYM: 121,
  NYY: 147, OAK: 133, PHI: 143, PIT: 134, SDP: 135, SEA: 136, SFG: 137, STL: 138, TBD: 139,
  TEX: 140, TOR: 141, WSN: 120,
};

/**
 * Modern franchise logo URL, or null if the franchise does not map cleanly.
 * NHL franchise ids are the current triCodes, so they resolve straight to the
 * NHL asset CDN; MLB ids go through the Lahman -> MLB Stats id map.
 */
export function franchiseLogo(franchiseId: string, sport: Sport, onBg: 'light' | 'dark' = 'dark'): string | null {
  if (sport === 'nhl') {
    // NHL has two variants: `_dark` is the white logo for dark backgrounds,
    // `_light` is the colored logo for light backgrounds.
    return `https://assets.nhle.com/logos/nhl/svg/${franchiseId}_${onBg}.svg`;
  }
  const id = MLB_FRANCHISE_ID[franchiseId];
  return id ? `https://www.mlbstatic.com/team-logos/${id}.svg` : null;
}

/** The franchise's primary brand color (for team pills), or null if unmatched. */
export function franchiseColor(franchiseId: string, sport: Sport): string | null {
  const teams = sport === 'nhl' ? NHL_TEAMS : MLB_TEAMS;
  const team = Object.values(teams).find((t) => t.abbreviation === franchiseId);
  return team?.colors.primary ?? null;
}
