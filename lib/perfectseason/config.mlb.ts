/**
 * MLB sport config for 162-0. Slots, season length, set structure, stat
 * columns, and verdict line sets. The engine and sim are sport-agnostic and
 * read everything they need from a SportConfig (spec Section 9).
 */

import type { SportConfig } from './types';

const SETS_OF_FIVE = 32;
const FINALE = 2;

export const mlbConfig: SportConfig = {
  sport: 'mlb',
  games: 162,
  // Nine fielding positions: a starting pitcher plus the eight defensive spots,
  // each a specific position (no infield/outfield buckets). Scorecard order.
  slots: [
    { id: 'SP', label: 'SP', accepts: ['SP'] },
    { id: 'C', label: 'C', accepts: ['C'] },
    { id: '1B', label: '1B', accepts: ['1B'] },
    { id: '2B', label: '2B', accepts: ['2B'] },
    { id: '3B', label: '3B', accepts: ['3B'] },
    { id: 'SS', label: 'SS', accepts: ['SS'] },
    { id: 'LF', label: 'LF', accepts: ['LF'] },
    { id: 'CF', label: 'CF', accepts: ['CF'] },
    { id: 'RF', label: 'RF', accepts: ['RF'] },
  ],
  setSizes: [...Array<number>(SETS_OF_FIVE).fill(5), FINALE],
  statColumns: {
    bat: ['hr', 'rbi', 'avg', 'ops'],
    pitch: ['w', 'era', 'whip', 'so'],
  },
  positionGroups: [
    { key: 'All', accepts: null },
    { key: 'SP', accepts: ['SP'] },
    { key: 'C', accepts: ['C'] },
    { key: '1B', accepts: ['1B'] },
    { key: '2B', accepts: ['2B'] },
    { key: '3B', accepts: ['3B'] },
    { key: 'SS', accepts: ['SS'] },
    { key: 'LF', accepts: ['LF'] },
    { key: 'CF', accepts: ['CF'] },
    { key: 'RF', accepts: ['RF'] },
  ],
  totalStats: ['HR', 'RBI'],
  verdict: {
    // Standard: higher win totals are better. First band whose min is met wins.
    standard: [
      { min: 162, line: 'PERFECTION. 162-0. Nobody has ever done this.' },
      { min: 156, line: 'Immortal. The greatest season ever assembled.' },
      { min: 148, line: 'Dynasty. They will tell stories about this team.' },
      { min: 138, line: 'A juggernaut. October is a formality.' },
      { min: 124, line: 'A powerhouse. Division locked up by August.' },
      { min: 108, line: 'A real contender. Playoff bound.' },
      { min: 95, line: 'October, then heartbreak.' },
      { min: 82, line: 'Right at .500. A summer of maybe.' },
      { min: 68, line: 'Sell at the deadline.' },
      { min: 50, line: 'A long season. Top of the draft beckons.' },
      { min: 0, line: 'Historically bad. Mercifully, it is over.' },
    ],
    // Tank: fewer wins is better. First band whose min is met wins.
    tank: [
      { min: 130, line: 'You accidentally tried. This team is good.' },
      { min: 100, line: 'Too competitive. The veterans keep winning.' },
      { min: 80, line: 'Middling. The tank stalled in traffic.' },
      { min: 55, line: 'Now we are tanking. Eyes on the lottery.' },
      { min: 35, line: 'A generational lottery position. Beautiful.' },
      { min: 1, line: 'Historic futility. The front office is thrilled.' },
      { min: 0, line: '0-162. The Perfect Tank. This should be impossible.' },
    ],
  },
  blindLabel: 'BallIQ',
  shareIcon: '⚾',
};
