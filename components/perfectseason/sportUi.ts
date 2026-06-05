import type { Sport } from '@/lib/perfectseason/types';

// Sport-specific header chrome (label, league shield, palette, home link), shared
// by both the MLB (PlayClient) and NHL (NhlBoardView) layouts.
export const SPORT_UI: Record<
  Sport,
  { label: string; logo: string; logoClass: string; bg: string; border: string; home: string }
> = {
  mlb: {
    label: '162-0',
    logo: 'https://www.mlbstatic.com/team-logos/league-on-dark/1.svg',
    logoClass: 'h-6 w-auto',
    bg: '#002D72',
    border: '#041E42',
    home: '/162-0',
  },
  nhl: {
    label: '82-0',
    logo: 'https://assets.nhle.com/logos/nhl/svg/NHL_light.svg',
    // NHL shield is narrower (1.5 vs 1.78 aspect), so a touch taller matches the
    // MLB logo's rendered width.
    logoClass: 'h-7 w-auto',
    bg: '#002D72',
    border: '#041E42',
    home: '/82-0',
  },
};
