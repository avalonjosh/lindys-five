// NFL team display-name -> ESPN abbreviation, for building logo URLs. The
// schedule ingest stores the opponent as ESPN's `team.displayName` (see
// lib/pickthebills/schedule.ts), so we key off that exact string. ESPN serves
// team logos at a.espncdn.com (already allowlisted in next.config.js).

const NFL_ABBR: Record<string, string> = {
  'Arizona Cardinals': 'ari',
  'Atlanta Falcons': 'atl',
  'Baltimore Ravens': 'bal',
  'Buffalo Bills': 'buf',
  'Carolina Panthers': 'car',
  'Chicago Bears': 'chi',
  'Cincinnati Bengals': 'cin',
  'Cleveland Browns': 'cle',
  'Dallas Cowboys': 'dal',
  'Denver Broncos': 'den',
  'Detroit Lions': 'det',
  'Green Bay Packers': 'gb',
  'Houston Texans': 'hou',
  'Indianapolis Colts': 'ind',
  'Jacksonville Jaguars': 'jax',
  'Kansas City Chiefs': 'kc',
  'Las Vegas Raiders': 'lv',
  'Los Angeles Chargers': 'lac',
  'Los Angeles Rams': 'lar',
  'Miami Dolphins': 'mia',
  'Minnesota Vikings': 'min',
  'New England Patriots': 'ne',
  'New Orleans Saints': 'no',
  'New York Giants': 'nyg',
  'New York Jets': 'nyj',
  'Philadelphia Eagles': 'phi',
  'Pittsburgh Steelers': 'pit',
  'San Francisco 49ers': 'sf',
  'Seattle Seahawks': 'sea',
  'Tampa Bay Buccaneers': 'tb',
  'Tennessee Titans': 'ten',
  'Washington Commanders': 'wsh',
};

export const BILLS_LOGO = 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png';

// Logo URL for a stored opponent display name, or null if we can't map it
// (e.g. a placeholder "TBD" row) so the caller can fall back gracefully.
export function nflLogo(displayName: string): string | null {
  const abbr = NFL_ABBR[displayName];
  return abbr ? `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png` : null;
}
