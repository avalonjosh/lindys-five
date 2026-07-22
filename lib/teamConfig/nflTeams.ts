export interface NFLTeamConfig {
  sport: 'nfl';
  /** Unique across all sports (NHL owns jets/panthers, MLB owns giants/cardinals —
   * same precedent as MLB's txrangers). Used in What-If saves and favoriteTeam. */
  id: string;
  /** Nickname used in the public URL: /pick-the-{pickSlug}. Unique within the NFL. */
  pickSlug: string;
  espnId: number;
  name: string;
  city: string;
  /** ESPN abbreviation, used for schedule fetches and logo URLs. */
  abbreviation: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  logo: string;
}

const logo = (abbrev: string) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbrev.toLowerCase()}.png`;

const team = (
  id: string,
  pickSlug: string,
  espnId: number,
  city: string,
  name: string,
  abbreviation: string,
  primary: string,
  secondary: string
): NFLTeamConfig => ({
  sport: 'nfl',
  id,
  pickSlug,
  espnId,
  name,
  city,
  abbreviation,
  colors: { primary, secondary, accent: secondary },
  logo: logo(abbreviation),
});

/** All 32 NFL teams, keyed by collision-safe id. Colors from ESPN. */
export const NFL_TEAMS: Record<string, NFLTeamConfig> = {
  azcardinals: team('azcardinals', 'cardinals', 22, 'Arizona', 'Cardinals', 'ARI', '#A40227', '#FFFFFF'),
  falcons: team('falcons', 'falcons', 1, 'Atlanta', 'Falcons', 'ATL', '#A71930', '#000000'),
  ravens: team('ravens', 'ravens', 33, 'Baltimore', 'Ravens', 'BAL', '#29126F', '#9E7C0C'),
  bills: team('bills', 'bills', 2, 'Buffalo', 'Bills', 'BUF', '#00338D', '#D50A0A'),
  carpanthers: team('carpanthers', 'panthers', 29, 'Carolina', 'Panthers', 'CAR', '#0085CA', '#000000'),
  bears: team('bears', 'bears', 3, 'Chicago', 'Bears', 'CHI', '#0B1C3A', '#E64100'),
  bengals: team('bengals', 'bengals', 4, 'Cincinnati', 'Bengals', 'CIN', '#FB4F14', '#000000'),
  browns: team('browns', 'browns', 5, 'Cleveland', 'Browns', 'CLE', '#472A08', '#FF3C00'),
  cowboys: team('cowboys', 'cowboys', 6, 'Dallas', 'Cowboys', 'DAL', '#002A5C', '#B0B7BC'),
  broncos: team('broncos', 'broncos', 7, 'Denver', 'Broncos', 'DEN', '#0A2343', '#FC4C02'),
  lions: team('lions', 'lions', 8, 'Detroit', 'Lions', 'DET', '#0076B6', '#BBBBBB'),
  packers: team('packers', 'packers', 9, 'Green Bay', 'Packers', 'GB', '#204E32', '#FFB612'),
  texans: team('texans', 'texans', 34, 'Houston', 'Texans', 'HOU', '#00143F', '#C41230'),
  colts: team('colts', 'colts', 11, 'Indianapolis', 'Colts', 'IND', '#003B75', '#FFFFFF'),
  jaguars: team('jaguars', 'jaguars', 30, 'Jacksonville', 'Jaguars', 'JAX', '#007487', '#D7A22A'),
  chiefs: team('chiefs', 'chiefs', 12, 'Kansas City', 'Chiefs', 'KC', '#E31837', '#FFB612'),
  raiders: team('raiders', 'raiders', 13, 'Las Vegas', 'Raiders', 'LV', '#000000', '#A5ACAF'),
  chargers: team('chargers', 'chargers', 24, 'Los Angeles', 'Chargers', 'LAC', '#0080C6', '#FFC20E'),
  rams: team('rams', 'rams', 14, 'Los Angeles', 'Rams', 'LAR', '#003594', '#FFD100'),
  dolphins: team('dolphins', 'dolphins', 15, 'Miami', 'Dolphins', 'MIA', '#008E97', '#FC4C02'),
  vikings: team('vikings', 'vikings', 16, 'Minnesota', 'Vikings', 'MIN', '#4F2683', '#FFC62F'),
  patriots: team('patriots', 'patriots', 17, 'New England', 'Patriots', 'NE', '#002A5C', '#C60C30'),
  saints: team('saints', 'saints', 18, 'New Orleans', 'Saints', 'NO', '#000000', '#D3BC8D'),
  nygiants: team('nygiants', 'giants', 19, 'New York', 'Giants', 'NYG', '#003C7F', '#C9243F'),
  nyjets: team('nyjets', 'jets', 20, 'New York', 'Jets', 'NYJ', '#115740', '#FFFFFF'),
  eagles: team('eagles', 'eagles', 21, 'Philadelphia', 'Eagles', 'PHI', '#06424D', '#A2AAAD'),
  steelers: team('steelers', 'steelers', 23, 'Pittsburgh', 'Steelers', 'PIT', '#000000', '#FFB612'),
  '49ers': team('49ers', '49ers', 25, 'San Francisco', '49ers', 'SF', '#AA0000', '#B3995D'),
  seahawks: team('seahawks', 'seahawks', 26, 'Seattle', 'Seahawks', 'SEA', '#002A5C', '#69BE28'),
  buccaneers: team('buccaneers', 'buccaneers', 27, 'Tampa Bay', 'Buccaneers', 'TB', '#BD1C36', '#3E3A35'),
  titans: team('titans', 'titans', 10, 'Tennessee', 'Titans', 'TEN', '#4495D2', '#001532'),
  commanders: team('commanders', 'commanders', 28, 'Washington', 'Commanders', 'WSH', '#5A1414', '#FFB612'),
};

/** Division membership, by collision-safe team id. */
export const NFL_DIVISIONS: Record<string, string[]> = {
  'AFC East': ['bills', 'dolphins', 'patriots', 'nyjets'],
  'AFC North': ['ravens', 'bengals', 'browns', 'steelers'],
  'AFC South': ['texans', 'colts', 'jaguars', 'titans'],
  'AFC West': ['broncos', 'chiefs', 'raiders', 'chargers'],
  'NFC East': ['cowboys', 'nygiants', 'eagles', 'commanders'],
  'NFC North': ['bears', 'lions', 'packers', 'vikings'],
  'NFC South': ['falcons', 'carpanthers', 'saints', 'buccaneers'],
  'NFC West': ['azcardinals', 'rams', '49ers', 'seahawks'],
};

const DIVISION_BY_ID: Record<string, string> = {};
for (const [division, ids] of Object.entries(NFL_DIVISIONS)) {
  for (const id of ids) DIVISION_BY_ID[id] = division;
}
const DIVISION_BY_ABBREV: Record<string, string> = Object.fromEntries(
  Object.values(NFL_TEAMS).map(t => [t.abbreviation.toUpperCase(), DIVISION_BY_ID[t.id]])
);

export function nflDivision(teamId: string): string | null {
  return DIVISION_BY_ID[teamId] ?? null;
}

export function nflDivisionByAbbrev(abbrev: string): string | null {
  return DIVISION_BY_ABBREV[abbrev.toUpperCase()] ?? null;
}

/**
 * NHL market → NFL team(s), for cross-promoting Pick the {Team} on the NHL
 * trackers. Curated: shared-market only (Devils/Rangers/Islanders → the NY
 * teams that play in NJ; Carolina spans Raleigh→Charlotte). Canadian teams,
 * Utah, St. Louis, and Columbus have no NFL market pairing.
 */
export const NFL_BY_NHL_MARKET: Record<string, string[]> = {
  sabres: ['bills'],
  bruins: ['patriots'],
  rangers: ['nygiants', 'nyjets'],
  islanders: ['nygiants', 'nyjets'],
  devils: ['nygiants', 'nyjets'],
  flyers: ['eagles'],
  penguins: ['steelers'],
  capitals: ['commanders'],
  hurricanes: ['carpanthers'],
  panthers: ['dolphins'],
  lightning: ['buccaneers'],
  redwings: ['lions'],
  blackhawks: ['bears'],
  wild: ['vikings'],
  avalanche: ['broncos'],
  stars: ['cowboys'],
  predators: ['titans'],
  goldenknights: ['raiders'],
  kings: ['rams', 'chargers'],
  ducks: ['rams', 'chargers'],
  sharks: ['49ers'],
  kraken: ['seahawks'],
};

/** Resolve a /pick-the-{pickSlug} URL segment to its team config. */
export function findNFLTeamByPickSlug(pickSlug: string): NFLTeamConfig | undefined {
  return Object.values(NFL_TEAMS).find((t) => t.pickSlug === pickSlug.toLowerCase());
}

/** All teams sorted by city for the pick-page nav. */
export const NFL_TEAM_LIST: NFLTeamConfig[] = Object.values(NFL_TEAMS).sort((a, b) =>
  `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`)
);
