/**
 * Authoritative server-side verification of a leaderboard submission.
 *
 * The game scores entirely in the browser, so the client is never trusted with
 * a score — it submits only the *picks*. The server re-derives everything: it
 * checks each pick against the real era pools (and, for the daily, the canonical
 * schedule's spin tree), rejects anything illegal, then recomputes the rating
 * and record from the validated picks with the server's own player scores.
 * A spoofed high score with real picks is silently re-scored to the truth;
 * impossible picks are rejected.
 */

import type { RoundTree, Spin } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { eligible } from '@/lib/perfectseason/engine';
import { poolPlayers } from '@/lib/perfectseason/schedule';
import { simulate } from '@/lib/perfectseason/sim';
import { rosterRating } from '@/lib/perfectseason/rating';
import { easternDateString } from '@/lib/perfectseason/seed';
import type { SharedTeamRow } from '@/lib/perfectseason/share';
import type { ScoreSubmission } from '@/lib/perfectseason/leaderboard';
import { getDataset } from './datasets';

export interface VerifiedScore {
  rating: number;
  grade: string;
  tier: string;
  wins: number;
  losses: number;
  rows: SharedTeamRow[];
}

export type VerifyResult = { ok: true; score: VerifiedScore } | { ok: false; error: string };

const sameSpin = (a: Spin, b: Spin) => a.decade === b.decade && a.franchise === b.franchise;

/** The legal schedule node for a round given the skip flags recorded on a pick. */
function nodeForSkips(tree: RoundTree, skips: { team: boolean; decade: boolean }): Spin[] {
  if (skips.team && skips.decade) return [tree.teamThenDecade, tree.decadeThenTeam].filter(Boolean) as Spin[];
  if (skips.team) return tree.teamSkip ? [tree.teamSkip] : [];
  if (skips.decade) return tree.decadeSkip ? [tree.decadeSkip] : [];
  return [tree.primary];
}

function yesterdayEt(): string {
  const d = new Date(`${easternDateString()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function verifySubmission(sub: ScoreSubmission): VerifyResult {
  const { sport, modeType, source, picks } = sub;
  if (sport !== 'nhl' && sport !== 'mlb') return { ok: false, error: 'Bad sport' };
  const { data, config, schedule } = getDataset(sport);
  const mode = { type: modeType, source, franchiseId: sub.franchiseId };

  // Shape: one pick per slot, contiguous rounds 0..n-1, sorted.
  if (!Array.isArray(picks) || picks.length !== config.slots.length) return { ok: false, error: 'Wrong pick count' };
  const ordered = [...picks].sort((a, b) => a.round - b.round);
  if (ordered.some((p, i) => p.round !== i)) return { ok: false, error: 'Bad round sequence' };

  // Skip budget: each currency is one-use; franchise mode has no team skip.
  if (ordered.filter((p) => p.skips?.team).length > 1) return { ok: false, error: 'Too many team skips' };
  if (ordered.filter((p) => p.skips?.decade).length > 1) return { ok: false, error: 'Too many decade skips' };
  if (modeType === 'franchise' && ordered.some((p) => p.skips?.team)) return { ok: false, error: 'Franchise has no team skip' };

  // Daily is bound to the canonical schedule for its date; free play just has to
  // use real era pools (any reachable spin is fair game on a random board).
  if (source === 'daily') {
    if (modeType !== 'standard') return { ok: false, error: 'Daily is standard only' };
    const date = sub.date;
    if (!date || (date !== easternDateString() && date !== yesterdayEt())) return { ok: false, error: 'Bad daily date' };
    const day = schedule.days[date];
    if (!day || day.rounds.length !== ordered.length) return { ok: false, error: 'No schedule for date' };
    for (let i = 0; i < ordered.length; i++) {
      const legal = nodeForSkips(day.rounds[i], ordered[i].skips ?? { team: false, decade: false });
      if (!legal.some((s) => sameSpin(s, ordered[i].spin))) return { ok: false, error: `Illegal spin at round ${i}` };
    }
  } else if (modeType === 'franchise') {
    const fid = sub.franchiseId;
    if (!fid || !data.franchises.some((f) => f.id === fid)) return { ok: false, error: 'Bad franchise' };
    if (ordered.some((p) => p.spin.franchise !== fid)) return { ok: false, error: 'Franchise mismatch' };
  }

  // Validate each pick against the real pool and recompute scores from the data.
  const usedPlayers = new Set<string>();
  const usedSlots = new Set<string>();
  const verified: PickRecord[] = [];
  for (const p of ordered) {
    const pool = poolPlayers(data, p.spin, config);
    if (pool.length === 0) return { ok: false, error: 'Unknown spin' };
    const player = pool.find((pl) => pl.id === p.playerId);
    if (!player) return { ok: false, error: 'Player not in pool' };
    const slot = config.slots.find((s) => s.id === p.slotId);
    if (!slot || !eligible(player, slot)) return { ok: false, error: 'Ineligible slot' };
    if (usedPlayers.has(player.id)) return { ok: false, error: 'Duplicate player' };
    if (usedSlots.has(slot.id)) return { ok: false, error: 'Duplicate slot' };
    usedPlayers.add(player.id);
    usedSlots.add(slot.id);
    verified.push({ ...p, playerName: player.name, score: player.score });
  }

  // Authoritative score from the validated picks (server scores only).
  const result = simulate(verified.map((p) => p.score), mode, config);
  const { rating, grade, tier } = rosterRating(data, config, verified, modeType);

  const rows: SharedTeamRow[] = verified.map((p) => {
    const pool = poolPlayers(data, p.spin, config);
    const higher = pool.filter((pl) => pl.score > p.score).length;
    const rowTier = higher === 0 ? 'green' : higher < 3 ? 'yellow' : 'gray';
    const f = data.franchises.find((fr) => fr.id === p.spin.franchise);
    const slot = config.slots.find((s) => s.id === p.slotId);
    return {
      slot: slot?.label ?? p.slotId,
      playerName: p.playerName,
      franchise: f?.names[p.spin.decade] ?? p.spin.franchise,
      franchiseId: p.spin.franchise,
      decade: p.spin.decade,
      tier: rowTier,
    };
  });

  return { ok: true, score: { rating, grade, tier, wins: result.wins, losses: result.losses, rows } };
}
