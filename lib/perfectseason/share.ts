/**
 * The spoiler-safe daily share grid (spec Section 10). Shows the slot, a tier
 * emoji (green = top option, yellow = top three, gray = below), and the
 * era-correct team, plus skips used. The URL line is the growth mechanism.
 */

import type { SportConfig } from './types';
import type { DailyRecord } from './storage';

const EMOJI = { green: '🟩', yellow: '🟨', gray: '⬜' } as const;

function shortDecade(d: string): string {
  return d.length === 5 ? d.slice(2) : d;
}

export function buildDailyShare(rec: DailyRecord, config: SportConfig, variant: 'classic' | 'blind'): string {
  const title = config.sport === 'mlb' ? '162-0' : '82-0';
  const brain = variant === 'blind' ? ' 🧠' : '';
  const lines: string[] = [
    `${title} ${config.shareIcon} Daily #${rec.dayNumber}${brain}`,
    `🏆 ${rec.wins}-${rec.losses} · ${rec.setsWon}/${rec.totalSets} sets`,
    '',
  ];
  for (const c of rec.grid) {
    lines.push(`${c.slot.padEnd(3)}${EMOJI[c.tier]} ${shortDecade(c.decade)} ${c.franchise}`);
  }
  if (rec.skips.team) lines.push('⏭️ team skip used');
  if (rec.skips.decade) lines.push('⏭️ decade skip used');
  lines.push('', `lindysfive.com/${title}`);
  return lines.join('\n');
}
