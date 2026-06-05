/**
 * NHL sport config for 82-0. Slots, season length, set structure, stat columns,
 * and verdict line sets. The engine and sim are sport-agnostic and read
 * everything they need from a SportConfig (spec Section 9). Mirrors config.mlb.ts.
 *
 * Slots are LW/C/RW/D1/D2/G: a generic defense pair (both accept "D") because
 * the data source records only "D", not a left/right split (spec amended
 * 2026-06-04). statColumns reuses the shared { bat, pitch } keys semantically:
 * bat = skater columns, pitch = goalie columns. Verdict copy: progress 12.7.
 */

import type { SportConfig } from './types';

const SETS_OF_FIVE = 16;
const FINALE = 2;

export const nhlConfig: SportConfig = {
  sport: 'nhl',
  games: 82,
  // Three forward lines collapse to one of each wing plus center, two defense
  // (generic pair), and a goaltender. Roster-card order.
  slots: [
    { id: 'LW', label: 'LW', accepts: ['LW'] },
    { id: 'C', label: 'C', accepts: ['C'] },
    { id: 'RW', label: 'RW', accepts: ['RW'] },
    { id: 'D1', label: 'D', accepts: ['D'] },
    { id: 'D2', label: 'D', accepts: ['D'] },
    { id: 'G', label: 'G', accepts: ['G'] },
  ],
  setSizes: [...Array<number>(SETS_OF_FIVE).fill(5), FINALE],
  statColumns: {
    bat: ['g', 'a', 'p', 'plusMinus'], // skaters
    pitch: ['svp', 'gaa', 'w', 'so'], // goalies
  },
  positionGroups: [
    { key: 'All', accepts: null },
    { key: 'C', accepts: ['C'] },
    { key: 'LW', accepts: ['LW'] },
    { key: 'RW', accepts: ['RW'] },
    { key: 'D', accepts: ['D'] },
    { key: 'G', accepts: ['G'] },
  ],
  totalStats: ['G', 'A', 'P'],
  verdict: {
    // Standard: higher win totals are better. First band whose min is met wins.
    standard: [
      { min: 82, line: 'PERFECTION. 82-0. Nobody has ever done this.' },
      { min: 75, line: 'Immortal. The greatest season ever assembled.' },
      { min: 67, line: 'A dynasty. They will tell stories about this team.' },
      { min: 62, line: 'A juggernaut. You matched the all-time wins record.' },
      { min: 55, line: "A powerhouse. The Presidents' Trophy is a formality." },
      { min: 48, line: 'A real contender. Home ice is locked up.' },
      { min: 42, line: 'Right around .500. A playoff push that could go either way.' },
      { min: 36, line: 'On the wrong side of the bubble. Golf in April.' },
      { min: 28, line: 'Lottery-bound. The playoffs start without you.' },
      { min: 18, line: 'A brutal winter. Bottom of the league.' },
      { min: 0, line: 'Historically bad. Mercifully, it is over.' },
    ],
    // Tank: fewer wins is better. First band whose min is met wins.
    tank: [
      { min: 66, line: 'You accidentally tried. This roster is too good to lose.' },
      { min: 50, line: 'Too competitive. The veterans keep stealing two points.' },
      { min: 38, line: 'Middling. The tank stalled in the standings.' },
      { min: 26, line: 'Now we are tanking. The lottery is in sight.' },
      { min: 14, line: 'A generational lottery position. Beautiful.' },
      { min: 1, line: 'Historic futility. The front office is thrilled.' },
      { min: 0, line: '0-82. The Perfect Tank. This should be impossible.' },
    ],
  },
  blindLabel: 'IceIQ',
  shareIcon: '🏒', // hockey stick
};
