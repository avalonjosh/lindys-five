export interface TeamConfig {
  id: string;
  nhlId: number;
  name: string;
  city: string;
  abbreviation: string;
  slug: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  darkMode?: {
    background: string;
    backgroundGradient?: string;
    cardBackground?: string; // Optional: separate background for cards (if different from page background)
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

export const TEAMS: Record<string, TeamConfig> = {
  sabres: {
    id: 'sabres',
    nhlId: 7,
    name: 'Sabres',
    city: 'Buffalo',
    abbreviation: 'BUF',
    slug: 'sabres',
    colors: {
      primary: '#003087', // Original sabres-blue (for accents, borders, progress bars)
      secondary: '#0A1128', // Original sabres-navy (for headings, dark text)
      accent: '#FFB81C' // Original sabres-gold (for labels, highlights)
    },
    darkMode: {
      background: '#000000', // Black background (GOAT mode)
      backgroundGradient: 'from-black to-zinc-900',
      accent: '#ef4444', // Red accent (GOAT mode)
      border: '#dc2626', // Red border
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/BUF_light.svg',
    altLogo: '/goat-logo.png'
  },
  canadiens: {
    id: 'canadiens',
    nhlId: 8,
    name: 'Canadiens',
    city: 'Montreal',
    abbreviation: 'MTL',
    slug: 'canadiens',
    colors: {
      primary: '#AF1E2D', // Red
      secondary: '#192168', // Blue
      accent: '#FFFFFF' // White
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#AF1E2D', // Canadiens red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/MTL_light.svg'
  },
  redwings: {
    id: 'redwings',
    nhlId: 17,
    name: 'Red Wings',
    city: 'Detroit',
    abbreviation: 'DET',
    slug: 'redwings',
    colors: {
      primary: '#CE1126', // Red Wings red
      secondary: '#FFFFFF', // White
      accent: '#CE1126' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126', // Red Wings red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg',
    altLogo: '/redwings-vintage.png'
  },
  senators: {
    id: 'senators',
    nhlId: 9,
    name: 'Senators',
    city: 'Ottawa',
    abbreviation: 'OTT',
    slug: 'senators',
    colors: {
      primary: '#C52032', // Senators red
      secondary: '#000000', // Black
      accent: '#C8AA76' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C52032', // Senators red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg',
    altLogo: '/senators-vintage.svg'
  },
  panthers: {
    id: 'panthers',
    nhlId: 13,
    name: 'Panthers',
    city: 'Florida',
    abbreviation: 'FLA',
    slug: 'panthers',
    colors: {
      primary: '#C8102E', // Panthers red
      secondary: '#041E42', // Navy blue
      accent: '#B9975B' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E', // Panthers red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg',
    altLogo: '/panthers-vintage.png'
  },
  mapleleafs: {
    id: 'mapleleafs',
    nhlId: 10,
    name: 'Maple Leafs',
    city: 'Toronto',
    abbreviation: 'TOR',
    slug: 'mapleleafs',
    colors: {
      primary: '#003E7E', // Maple Leafs blue
      secondary: '#FFFFFF', // White
      accent: '#003E7E' // Blue
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#003E7E', // Maple Leafs blue
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/TOR_light.svg'
  },
  lightning: {
    id: 'lightning',
    nhlId: 14,
    name: 'Lightning',
    city: 'Tampa Bay',
    abbreviation: 'TBL',
    slug: 'lightning',
    colors: {
      primary: '#002868', // Lightning blue
      secondary: '#FFFFFF', // White
      accent: '#002868' // Blue
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFFFFF', // White for visibility
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg',
    altLogo: '/lightning-vintage.png'
  },
  bruins: {
    id: 'bruins',
    nhlId: 6,
    name: 'Bruins',
    city: 'Boston',
    abbreviation: 'BOS',
    slug: 'bruins',
    colors: {
      primary: '#000000', // Black
      secondary: '#FFB81C', // Gold
      accent: '#FFB81C' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFB81C', // Bruins gold
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg',
    altLogo: '/bruins-pooh-bear.png'
  },
  devils: {
    id: 'devils',
    nhlId: 1,
    name: 'Devils',
    city: 'New Jersey',
    abbreviation: 'NJD',
    slug: 'devils',
    colors: {
      primary: '#CE1126', // Devils red
      secondary: '#000000', // Black
      accent: '#CE1126' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126', // Devils red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NJD_light.svg'
  },
  penguins: {
    id: 'penguins',
    nhlId: 5,
    name: 'Penguins',
    city: 'Pittsburgh',
    abbreviation: 'PIT',
    slug: 'penguins',
    colors: {
      primary: '#000000', // Black
      secondary: '#FCB514', // Vegas gold
      accent: '#FCB514' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FCB514', // Penguins gold
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/PIT_light.svg',
    altLogo: '/penguins-vintage.png'
  },
  hurricanes: {
    id: 'hurricanes',
    nhlId: 12,
    name: 'Hurricanes',
    city: 'Carolina',
    abbreviation: 'CAR',
    slug: 'hurricanes',
    colors: {
      primary: '#CE1126', // Red
      secondary: '#000000', // Black
      accent: '#CE1126' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126', // Hurricanes red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CAR_light.svg'
  },
  capitals: {
    id: 'capitals',
    nhlId: 15,
    name: 'Capitals',
    city: 'Washington',
    abbreviation: 'WSH',
    slug: 'capitals',
    colors: {
      primary: '#041E42', // Navy blue
      secondary: '#C8102E', // Red
      accent: '#C8102E' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E', // Capitals red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/WSH_light.svg'
  },
  islanders: {
    id: 'islanders',
    nhlId: 2,
    name: 'Islanders',
    city: 'New York',
    abbreviation: 'NYI',
    slug: 'islanders',
    colors: {
      primary: '#00539B', // Royal blue
      secondary: '#F47D30', // Orange
      accent: '#F47D30' // Orange
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F47D30', // Islanders orange
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NYI_light.svg'
  },
  flyers: {
    id: 'flyers',
    nhlId: 4,
    name: 'Flyers',
    city: 'Philadelphia',
    abbreviation: 'PHI',
    slug: 'flyers',
    colors: {
      primary: '#F74902', // Orange
      secondary: '#000000', // Black
      accent: '#F74902' // Orange
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F74902', // Flyers orange
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/PHI_light.svg'
  },
  bluejackets: {
    id: 'bluejackets',
    nhlId: 29,
    name: 'Blue Jackets',
    city: 'Columbus',
    abbreviation: 'CBJ',
    slug: 'bluejackets',
    colors: {
      primary: '#002654', // Navy blue
      secondary: '#CE1126', // Red
      accent: '#CE1126' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126', // Blue Jackets red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CBJ_light.svg'
  },
  rangers: {
    id: 'rangers',
    nhlId: 3,
    name: 'Rangers',
    city: 'New York',
    abbreviation: 'NYR',
    slug: 'rangers',
    colors: {
      primary: '#0038A8', // Royal blue
      secondary: '#CE1126', // Red
      accent: '#CE1126' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CE1126', // Rangers red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NYR_light.svg'
  },
  utah: {
    id: 'utah',
    nhlId: 59,
    name: 'Mammoth',
    city: 'Utah',
    abbreviation: 'UTA',
    slug: 'utah',
    colors: {
      primary: '#69B3E7', // Utah blue
      secondary: '#000000', // Black
      accent: '#69B3E7' // Blue
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#69B3E7', // Utah blue
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg'
  },
  avalanche: {
    id: 'avalanche',
    nhlId: 21,
    name: 'Avalanche',
    city: 'Colorado',
    abbreviation: 'COL',
    slug: 'avalanche',
    colors: {
      primary: '#6F263D', // Burgundy
      secondary: '#236192', // Steel blue
      accent: '#236192' // Steel blue
    },
    darkMode: {
      background: '#5AB7E6', // Nordiques powder blue page background (ice rink feel)
      backgroundGradient: 'from-[#5AB7E6] to-[#4AA5D4]',
      cardBackground: '#FFFFFF', // White cards for clean look against powder blue
      accent: '#E4002B', // Nordiques red
      border: '#002654', // Nordiques navy blue
      text: '#002654' // Navy blue text for contrast
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/COL_light.svg',
    altLogo: '/nordiques-logo.png'
  },
  jets: {
    id: 'jets',
    nhlId: 52,
    name: 'Jets',
    city: 'Winnipeg',
    abbreviation: 'WPG',
    slug: 'jets',
    colors: {
      primary: '#041E42', // Navy blue
      secondary: '#AC162C', // Red
      accent: '#AC162C' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#AC162C', // Jets red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/WPG_light.svg'
  },
  stars: {
    id: 'stars',
    nhlId: 25,
    name: 'Stars',
    city: 'Dallas',
    abbreviation: 'DAL',
    slug: 'stars',
    colors: {
      primary: '#006847', // Victory green
      secondary: '#8F8F8C', // Silver
      accent: '#8F8F8C' // Silver
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#8F8F8C', // Stars silver
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/DAL_light.svg'
  },
  blackhawks: {
    id: 'blackhawks',
    nhlId: 16,
    name: 'Blackhawks',
    city: 'Chicago',
    abbreviation: 'CHI',
    slug: 'blackhawks',
    colors: {
      primary: '#CF0A2C', // Red
      secondary: '#000000', // Black
      accent: '#CF0A2C' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#CF0A2C', // Blackhawks red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CHI_light.svg',
    altLogo: '/blackhawks-vintage.png'
  },
  predators: {
    id: 'predators',
    nhlId: 18,
    name: 'Predators',
    city: 'Nashville',
    abbreviation: 'NSH',
    slug: 'predators',
    colors: {
      primary: '#FFB81C', // Gold
      secondary: '#041E42', // Navy blue
      accent: '#FFB81C' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FFB81C', // Predators gold
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/NSH_light.svg'
  },
  wild: {
    id: 'wild',
    nhlId: 30,
    name: 'Wild',
    city: 'Minnesota',
    abbreviation: 'MIN',
    slug: 'wild',
    colors: {
      primary: '#154734', // Forest green
      secondary: '#A6192E', // Red
      accent: '#A6192E' // Red
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#A6192E', // Wild red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/MIN_light.svg'
  },
  blues: {
    id: 'blues',
    nhlId: 19,
    name: 'Blues',
    city: 'St. Louis',
    abbreviation: 'STL',
    slug: 'blues',
    colors: {
      primary: '#002F87', // Blue
      secondary: '#FCB514', // Gold
      accent: '#FCB514' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FCB514', // Blues gold
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/STL_light.svg'
  },
  goldenknights: {
    id: 'goldenknights',
    nhlId: 54,
    name: 'Golden Knights',
    city: 'Vegas',
    abbreviation: 'VGK',
    slug: 'goldenknights',
    colors: {
      primary: '#B4975A', // Gold
      secondary: '#333F42', // Steel gray
      accent: '#B4975A' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#B4975A', // Golden Knights gold
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/VGK_light.svg'
  },
  oilers: {
    id: 'oilers',
    nhlId: 22,
    name: 'Oilers',
    city: 'Edmonton',
    abbreviation: 'EDM',
    slug: 'oilers',
    colors: {
      primary: '#041E42', // Navy blue
      secondary: '#FF4C00', // Orange
      accent: '#FF4C00' // Orange
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#FF4C00', // Oilers orange
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/EDM_light.svg'
  },
  canucks: {
    id: 'canucks',
    nhlId: 23,
    name: 'Canucks',
    city: 'Vancouver',
    abbreviation: 'VAN',
    slug: 'canucks',
    colors: {
      primary: '#00205B', // Navy blue
      secondary: '#00843D', // Green
      accent: '#00843D' // Green
    },
    darkMode: {
      background: '#000000', // Black background (flying skate era)
      backgroundGradient: 'from-black to-zinc-900',
      accent: '#F4A900', // Yellow/gold (flying skate era)
      border: '#C8102E', // Red border (flying skate era)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/VAN_light.svg',
    altLogo: '/canucks-flying-skate.png'
  },
  flames: {
    id: 'flames',
    nhlId: 20,
    name: 'Flames',
    city: 'Calgary',
    abbreviation: 'CGY',
    slug: 'flames',
    colors: {
      primary: '#C8102E', // Red
      secondary: '#F1BE48', // Gold
      accent: '#F1BE48' // Gold
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#C8102E', // Flames red
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/CGY_light.svg'
  },
  kings: {
    id: 'kings',
    nhlId: 26,
    name: 'Kings',
    city: 'Los Angeles',
    abbreviation: 'LAK',
    slug: 'kings',
    colors: {
      primary: '#111111', // Black
      secondary: '#A2AAAD', // Silver
      accent: '#A2AAAD' // Silver
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#A2AAAD', // Kings silver
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/LAK_light.svg'
  },
  ducks: {
    id: 'ducks',
    nhlId: 24,
    name: 'Ducks',
    city: 'Anaheim',
    abbreviation: 'ANA',
    slug: 'ducks',
    colors: {
      primary: '#F47A38', // Orange
      secondary: '#B9975B', // Gold
      accent: '#F47A38' // Orange
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#F47A38', // Ducks orange
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/ANA_light.svg'
  },
  sharks: {
    id: 'sharks',
    nhlId: 28,
    name: 'Sharks',
    city: 'San Jose',
    abbreviation: 'SJS',
    slug: 'sharks',
    colors: {
      primary: '#006D75', // Teal
      secondary: '#EA7200', // Orange
      accent: '#006D75' // Teal
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#006D75', // Sharks teal
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/SJS_light.svg'
  },
  kraken: {
    id: 'kraken',
    nhlId: 55,
    name: 'Kraken',
    city: 'Seattle',
    abbreviation: 'SEA',
    slug: 'kraken',
    colors: {
      primary: '#001628', // Deep sea blue
      secondary: '#96D8D8', // Ice blue
      accent: '#96D8D8' // Ice blue
    },
    darkMode: {
      background: '#1a1a1a', // Neutral dark gray
      backgroundGradient: 'from-[#1a1a1a] to-[#0f0f0f]',
      accent: '#96D8D8', // Kraken ice blue
      border: '#27272a', // Medium dark gray (zinc-800)
      text: '#ffffff' // White text
    },
    logo: 'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg'
  }
};
