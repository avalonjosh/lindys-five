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
  }
};
