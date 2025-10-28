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
    logo: 'https://assets.nhle.com/logos/nhl/svg/DET_light.svg'
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
    logo: 'https://assets.nhle.com/logos/nhl/svg/OTT_light.svg'
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
    logo: 'https://assets.nhle.com/logos/nhl/svg/FLA_light.svg'
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
    logo: 'https://assets.nhle.com/logos/nhl/svg/TBL_light.svg'
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
    logo: 'https://assets.nhle.com/logos/nhl/svg/BOS_light.svg'
  }
};
