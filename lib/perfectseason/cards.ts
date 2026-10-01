/**
 * Streak cards: a collectible earned for a run of consecutive Daily plays in
 * one game (82-0 earns hockey cards, 162-0 baseball cards). The card shows the
 * best player from that day's Daily lineup on a jersey back.
 */

import type { PlayerLine, Sport } from './types';
import { NHL_TEAMS, MLB_TEAMS } from '@/lib/teamConfig';

export type CardTier = 'bronze' | 'silver' | 'gold';

/** Streak lengths that earn a card, per game. No streak-saver: a missed day resets. */
export const CARD_MILESTONES: Record<Sport, { days: number; tier: CardTier }[]> = {
  nhl: [
    { days: 7, tier: 'bronze' },
    { days: 30, tier: 'silver' },
    { days: 82, tier: 'gold' },
  ],
  mlb: [
    { days: 7, tier: 'bronze' },
    { days: 30, tier: 'silver' },
    { days: 162, tier: 'gold' },
  ],
};

export interface StreakCard {
  id: string;
  sport: Sport;
  tier: CardTier;
  /** Streak length it was earned at. */
  milestone: number;
  /** The Daily's date (YYYY-MM-DD, Eastern). */
  date: string;
  earnedAt: number;
  player: {
    id: string;
    name: string;
    pos: string[];
    /** Jersey number when known (the player's number per the league's API; not always the one worn that decade). */
    number: string | null;
    franchiseId: string;
    franchiseName: string;
    decade: string;
    line: PlayerLine;
  };
}

/** The next card this streak is heading for, or null past the last milestone. */
export function nextMilestone(sport: Sport, streak: number): { days: number; tier: CardTier; daysLeft: number } | null {
  const m = CARD_MILESTONES[sport].find((x) => x.days > streak);
  return m ? { ...m, daysLeft: m.days - streak } : null;
}

export const TIER_LABEL: Record<CardTier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };
export const TIER_FRAME: Record<CardTier, string> = { bronze: '#B87333', silver: '#AEB7C2', gold: '#D4AF37' };

/** Jersey colors for a card: the franchise's current primary, with its brightest
 * contrasting trim (same pick as the team page headers); Lindy's Five navy/gold
 * for franchises without a current team. */
export function jerseyColors(card: StreakCard): { body: string; trim: string } {
  const teams = card.sport === 'nhl' ? NHL_TEAMS : MLB_TEAMS;
  const team = Object.values(teams).find((t) => t.abbreviation === card.player.franchiseId);
  if (!team) return { body: '#003087', trim: '#FFB81C' };
  const { primary, secondary, accent } = team.colors;
  const same = (a: string, b: string) => a.toUpperCase() === b.toUpperCase();
  const trim = !same(accent, primary) ? accent : !same(secondary, primary) ? secondary : '#FFFFFF';
  return { body: primary, trim };
}
