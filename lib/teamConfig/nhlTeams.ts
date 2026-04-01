export interface TeamConfig {
  sport: 'nhl' | 'mlb';
  id: string;
  nhlId: number;
  name: string;
  city: string;
  abbreviation: string;
  slug: string;
  stubhubId: number; // StubHub performer ID for affiliate links
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  darkMode?: {
    background: string;
    backgroundGradient?: string;
    cardBackground?: string; // Optional: separate background for cards (if different from page background)
    headerBackground?: string; // Optional: separate background for header
    accent: string;
    border: string;
    text: string;
  };
  logo: string;
  altLogo?: string; // For GOAT mode
}

// Helper to get dark mode colors, falling back to defaults if not specified
export const getDarkModeColors = (team: TeamConfig) => {
  return team.darkMode || {
    background: '#000000',
    backgroundGradient: 'from-black to-zinc-900',
    accent: '#ef4444',
    border: '#dc2626',
    text: '#ffffff'
  };
};

export const NHL_TEAMS: Record<string, TeamConfig> = {
  sabres: {
    sport: 'nhl',
    id: 'sabres',
    nhlId: 7,
    name: 'Sabres',
    city: 'Buffalo',
    abbreviation: 'BUF',
    slug: 'sabres',
    stubhubId: 2356,
    colors: {
      primary: '#003087',
      secondary: '#0A1128',
      accent: '#FFB81C'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#ef4444',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg',
    altLogo: '/goat-logo.png'
  },
  canadiens: {
    sport: 'nhl',
    id: 'canadiens',
    nhlId: 8,
    name: 'Canadiens',
    city: 'Montreal',
    abbreviation: 'MTL',
    slug: 'canadiens',
    stubhubId: 7554,
    colors: {
      primary: '#AF1E2D',
      secondary: '#192168',
      accent: '#FFFFFF'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#AF1E2D',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg'
  },
  redwings: {
    sport: 'nhl',
    id: 'redwings',
    nhlId: 17,
    name: 'Red Wings',
    city: 'Detroit',
    abbreviation: 'DET',
    slug: 'redwings',
    stubhubId: 2767,
    colors: {
      primary: '#CE1126',
      secondary: '#FFFFFF',
      accent: '#CE1126'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg',
    altLogo: '/redwings-vintage.png'
  },
  senators: {
    sport: 'nhl',
    id: 'senators',
    nhlId: 9,
    name: 'Senators',
    city: 'Ottawa',
    abbreviation: 'OTT',
    slug: 'senators',
    stubhubId: 7551,
    colors: {
      primary: '#C52032',
      secondary: '#000000',
      accent: '#C8AA76'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C52032',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg',
    altLogo: '/senators-vintage.svg'
  },
  panthers: {
    sport: 'nhl',
    id: 'panthers',
    nhlId: 13,
    name: 'Panthers',
    city: 'Florida',
    abbreviation: 'FLA',
    slug: 'panthers',
    stubhubId: 150352299,
    colors: {
      primary: '#C8102E',
      secondary: '#041E42',
      accent: '#B9975B'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg',
    altLogo: '/panthers-vintage.png'
  },
  mapleleafs: {
    sport: 'nhl',
    id: 'mapleleafs',
    nhlId: 10,
    name: 'Maple Leafs',
    city: 'Toronto',
    abbreviation: 'TOR',
    slug: 'mapleleafs',
    stubhubId: 7550,
    colors: {
      primary: '#003E7E',
      secondary: '#FFFFFF',
      accent: '#003E7E'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#003E7E',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg'
  },
  lightning: {
    sport: 'nhl',
    id: 'lightning',
    nhlId: 14,
    name: 'Lightning',
    city: 'Tampa Bay',
    abbreviation: 'TBL',
    slug: 'lightning',
    stubhubId: 6355,
    colors: {
      primary: '#002868',
      secondary: '#FFFFFF',
      accent: '#002868'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFFFFF',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg',
    altLogo: '/lightning-vintage.png'
  },
  bruins: {
    sport: 'nhl',
    id: 'bruins',
    nhlId: 6,
    name: 'Bruins',
    city: 'Boston',
    abbreviation: 'BOS',
    slug: 'bruins',
    stubhubId: 2762,
    colors: {
      primary: '#000000',
      secondary: '#FFB81C',
      accent: '#FFB81C'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFB81C',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg',
    altLogo: '/bruins-pooh-bear.png'
  },
  devils: {
    sport: 'nhl',
    id: 'devils',
    nhlId: 1,
    name: 'Devils',
    city: 'New Jersey',
    abbreviation: 'NJD',
    slug: 'devils',
    stubhubId: 3023,
    colors: {
      primary: '#CE1126',
      secondary: '#000000',
      accent: '#CE1126'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NJD_light.svg'
  },
  penguins: {
    sport: 'nhl',
    id: 'penguins',
    nhlId: 5,
    name: 'Penguins',
    city: 'Pittsburgh',
    abbreviation: 'PIT',
    slug: 'penguins',
    stubhubId: 4822,
    colors: {
      primary: '#000000',
      secondary: '#FCB514',
      accent: '#FCB514'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FCB514',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/PIT_light.svg',
    altLogo: '/penguins-vintage.png'
  },
  hurricanes: {
    sport: 'nhl',
    id: 'hurricanes',
    nhlId: 12,
    name: 'Hurricanes',
    city: 'Carolina',
    abbreviation: 'CAR',
    slug: 'hurricanes',
    stubhubId: 3085,
    colors: {
      primary: '#CE1126',
      secondary: '#000000',
      accent: '#CE1126'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CAR_light.svg'
  },
  capitals: {
    sport: 'nhl',
    id: 'capitals',
    nhlId: 15,
    name: 'Capitals',
    city: 'Washington',
    abbreviation: 'WSH',
    slug: 'capitals',
    stubhubId: 762,
    colors: {
      primary: '#041E42',
      secondary: '#C8102E',
      accent: '#C8102E'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/WSH_light.svg'
  },
  islanders: {
    sport: 'nhl',
    id: 'islanders',
    nhlId: 2,
    name: 'Islanders',
    city: 'New York',
    abbreviation: 'NYI',
    slug: 'islanders',
    stubhubId: 6349,
    colors: {
      primary: '#00539B',
      secondary: '#F47D30',
      accent: '#F47D30'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F47D30',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg'
  },
  flyers: {
    sport: 'nhl',
    id: 'flyers',
    nhlId: 4,
    name: 'Flyers',
    city: 'Philadelphia',
    abbreviation: 'PHI',
    slug: 'flyers',
    stubhubId: 2763,
    colors: {
      primary: '#F74902',
      secondary: '#000000',
      accent: '#F74902'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F74902',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/PHI_light.svg'
  },
  bluejackets: {
    sport: 'nhl',
    id: 'bluejackets',
    nhlId: 29,
    name: 'Blue Jackets',
    city: 'Columbus',
    abbreviation: 'CBJ',
    slug: 'bluejackets',
    stubhubId: 6350,
    colors: {
      primary: '#002654',
      secondary: '#CE1126',
      accent: '#CE1126'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg'
  },
  rangers: {
    sport: 'nhl',
    id: 'rangers',
    nhlId: 3,
    name: 'Rangers',
    city: 'New York',
    abbreviation: 'NYR',
    slug: 'rangers',
    stubhubId: 2764,
    colors: {
      primary: '#0038A8',
      secondary: '#CE1126',
      accent: '#CE1126'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NYR_light.svg'
  },
  utah: {
    sport: 'nhl',
    id: 'utah',
    nhlId: 68,
    name: 'Mammoth',
    city: 'Utah',
    abbreviation: 'UTA',
    slug: 'utah',
    stubhubId: 158737474,
    colors: {
      primary: '#69B3E7',
      secondary: '#000000',
      accent: '#69B3E7'
    },
    darkMode: {
      background: '#E8D6C0',
      backgroundGradient: 'from-[#E8D6C0] to-[#D4BCA0]',
      accent: '#8C2633',
      border: '#8C2633',
      text: '#000000',
      cardBackground: '#F5EDE0',
      headerBackground: '#006B4B'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg',
    altLogo: '/Phoenix-Coyotes-Logo-1996 trans.png'
  },
  avalanche: {
    sport: 'nhl',
    id: 'avalanche',
    nhlId: 21,
    name: 'Avalanche',
    city: 'Colorado',
    abbreviation: 'COL',
    slug: 'avalanche',
    stubhubId: 2768,
    colors: {
      primary: '#6F263D',
      secondary: '#236192',
      accent: '#236192'
    },
    darkMode: {
      background: '#5AB7E6',
      backgroundGradient: 'from-[#5AB7E6] to-[#4AA5D4]',
      cardBackground: '#FFFFFF',
      accent: '#E4002B',
      border: '#002654',
      text: '#002654'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/COL_light.svg',
    altLogo: '/nordiques-logo.png'
  },
  jets: {
    sport: 'nhl',
    id: 'jets',
    nhlId: 52,
    name: 'Jets',
    city: 'Winnipeg',
    abbreviation: 'WPG',
    slug: 'jets',
    stubhubId: 508938,
    colors: {
      primary: '#041E42',
      secondary: '#AC162C',
      accent: '#AC162C'
    },
    darkMode: {
      background: '#FFFFFF',
      backgroundGradient: 'from-[#FFFFFF] to-[#F0F0F0]',
      accent: '#C8102E',
      border: '#C8102E',
      text: '#041E42',
      cardBackground: '#F8F8F8',
      headerBackground: '#FFFFFF'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/WPG_light.svg',
    altLogo: '/vintage jets trans.png'
  },
  stars: {
    sport: 'nhl',
    id: 'stars',
    nhlId: 25,
    name: 'Stars',
    city: 'Dallas',
    abbreviation: 'DAL',
    slug: 'stars',
    stubhubId: 2766,
    colors: {
      primary: '#006847',
      secondary: '#8F8F8C',
      accent: '#8F8F8C'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#8F8F8C',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/DAL_light.svg'
  },
  blackhawks: {
    sport: 'nhl',
    id: 'blackhawks',
    nhlId: 16,
    name: 'Blackhawks',
    city: 'Chicago',
    abbreviation: 'CHI',
    slug: 'blackhawks',
    stubhubId: 2769,
    colors: {
      primary: '#CF0A2C',
      secondary: '#000000',
      accent: '#CF0A2C'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CF0A2C',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CHI_light.svg',
    altLogo: '/blackhawks-vintage.png'
  },
  predators: {
    sport: 'nhl',
    id: 'predators',
    nhlId: 18,
    name: 'Predators',
    city: 'Nashville',
    abbreviation: 'NSH',
    slug: 'predators',
    stubhubId: 6351,
    colors: {
      primary: '#FFB81C',
      secondary: '#041E42',
      accent: '#FFB81C'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFB81C',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NSH_light.svg'
  },
  wild: {
    sport: 'nhl',
    id: 'wild',
    nhlId: 30,
    name: 'Wild',
    city: 'Minnesota',
    abbreviation: 'MIN',
    slug: 'wild',
    stubhubId: 2985,
    colors: {
      primary: '#154734',
      secondary: '#A6192E',
      accent: '#A6192E'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#A6192E',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/MIN_light.svg'
  },
  blues: {
    sport: 'nhl',
    id: 'blues',
    nhlId: 19,
    name: 'Blues',
    city: 'St. Louis',
    abbreviation: 'STL',
    slug: 'blues',
    stubhubId: 3086,
    colors: {
      primary: '#002F87',
      secondary: '#FCB514',
      accent: '#FCB514'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FCB514',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/STL_light.svg'
  },
  goldenknights: {
    sport: 'nhl',
    id: 'goldenknights',
    nhlId: 54,
    name: 'Golden Knights',
    city: 'Vegas',
    abbreviation: 'VGK',
    slug: 'goldenknights',
    stubhubId: 100270936,
    colors: {
      primary: '#B4975A',
      secondary: '#333F42',
      accent: '#B4975A'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#B4975A',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/VGK_light.svg'
  },
  oilers: {
    sport: 'nhl',
    id: 'oilers',
    nhlId: 22,
    name: 'Oilers',
    city: 'Edmonton',
    abbreviation: 'EDM',
    slug: 'oilers',
    stubhubId: 7555,
    colors: {
      primary: '#041E42',
      secondary: '#FF4C00',
      accent: '#FF4C00'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FF4C00',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/EDM_light.svg'
  },
  canucks: {
    sport: 'nhl',
    id: 'canucks',
    nhlId: 23,
    name: 'Canucks',
    city: 'Vancouver',
    abbreviation: 'VAN',
    slug: 'canucks',
    stubhubId: 7552,
    colors: {
      primary: '#00205B',
      secondary: '#00843D',
      accent: '#00843D'
    },
    darkMode: {
      background: '#000000',
      backgroundGradient: 'from-black to-zinc-900',
      accent: '#F4A900',
      border: '#C8102E',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/VAN_light.svg',
    altLogo: '/canucks-flying-skate.png'
  },
  flames: {
    sport: 'nhl',
    id: 'flames',
    nhlId: 20,
    name: 'Flames',
    city: 'Calgary',
    abbreviation: 'CGY',
    slug: 'flames',
    stubhubId: 7553,
    colors: {
      primary: '#C8102E',
      secondary: '#F1BE48',
      accent: '#F1BE48'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CGY_light.svg'
  },
  kings: {
    sport: 'nhl',
    id: 'kings',
    nhlId: 26,
    name: 'Kings',
    city: 'Los Angeles',
    abbreviation: 'LAK',
    slug: 'kings',
    stubhubId: 1382,
    colors: {
      primary: '#111111',
      secondary: '#A2AAAD',
      accent: '#A2AAAD'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#A2AAAD',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/LAK_light.svg'
  },
  ducks: {
    sport: 'nhl',
    id: 'ducks',
    nhlId: 24,
    name: 'Ducks',
    city: 'Anaheim',
    abbreviation: 'ANA',
    slug: 'ducks',
    stubhubId: 2802,
    colors: {
      primary: '#F47A38',
      secondary: '#B9975B',
      accent: '#F47A38'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F47A38',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/ANA_light.svg'
  },
  sharks: {
    sport: 'nhl',
    id: 'sharks',
    nhlId: 28,
    name: 'Sharks',
    city: 'San Jose',
    abbreviation: 'SJS',
    slug: 'sharks',
    stubhubId: 150405699,
    colors: {
      primary: '#006D75',
      secondary: '#EA7200',
      accent: '#006D75'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#006D75',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/SJS_light.svg'
  },
  kraken: {
    sport: 'nhl',
    id: 'kraken',
    nhlId: 55,
    name: 'Kraken',
    city: 'Seattle',
    abbreviation: 'SEA',
    slug: 'kraken',
    stubhubId: 50668503,
    colors: {
      primary: '#001628',
      secondary: '#96D8D8',
      accent: '#96D8D8'
    },
    darkMode: {
      background: '#1a1a1a',
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#96D8D8',
      border: '#27272a',
      text: '#ffffff'
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg'
  }
};
