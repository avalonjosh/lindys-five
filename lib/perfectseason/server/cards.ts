/**
 * Awarding streak cards. Runs after a signed-in Daily is saved: counts the
 * user's consecutive Daily days in that game (either variant counts), and on a
 * milestone day mints a card of the best player from that day's lineup.
 */

import { kv } from '@vercel/kv';
import { poolPlayers } from '../schedule';
import { CARD_MILESTONES, nextMilestone, type StreakCard } from '../cards';
import { userBoardsKey } from '../leaderboard';
import type { PickRecord } from '../engine';
import type { Player, Sport } from '../types';
import { getDataset } from './datasets';
import { cardsKey, cardRefKey } from '../cardStore';

const numberKey = (sport: Sport, playerId: string) => `ps:number:${sport}:${playerId}`;

function addDays(iso: string, delta: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Consecutive Daily days in this game ending on `date`, from the user's saved boards. */
export async function dailyStreak(userId: string, sport: Sport, date: string): Promise<number> {
  const boards = (await kv.hgetall<Record<string, number>>(userBoardsKey(userId))) ?? {};
  const days = new Set<string>();
  for (const board of Object.keys(boards)) {
    const [kind, s, , d] = board.split(':');
    if (kind === 'daily' && s === sport && d) days.add(d);
  }
  let streak = 0;
  for (let day = date; days.has(day); day = addDays(day, -1)) streak++;
  return streak;
}

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

/**
 * The player's jersey number from the league's own API, cached. NHL ids are
 * NHL player ids. MLB ids are Lahman ids, so the player is matched by name,
 * keeping only a match whose career spans the card's decade. null when unsure.
 */
async function jerseyNumber(sport: Sport, player: Player, decade: string): Promise<string | null> {
  const cached = await kv.get<string>(numberKey(sport, player.id));
  if (cached != null) return cached === '' ? null : cached;
  let number: string | null = null;
  try {
    if (sport === 'nhl') {
      const d = (await fetchJson(`https://api-web.nhle.com/v1/player/${player.id}/landing`)) as { sweaterNumber?: number };
      if (typeof d.sweaterNumber === 'number') number = String(d.sweaterNumber);
    } else {
      const d = (await fetchJson(`https://statsapi.mlb.com/api/v1/people/search?names=${encodeURIComponent(player.name)}`)) as {
        people?: { fullName?: string; primaryNumber?: string; mlbDebutDate?: string; lastPlayedDate?: string }[];
      };
      const start = Number(decade.slice(0, 4));
      const matches = (d.people ?? []).filter((p) => {
        if (p.fullName?.toLowerCase() !== player.name.toLowerCase() || !p.primaryNumber) return false;
        const debut = Number(p.mlbDebutDate?.slice(0, 4) ?? NaN);
        const last = Number(p.lastPlayedDate?.slice(0, 4) ?? NaN);
        return !Number.isNaN(debut) && debut <= start + 9 && (Number.isNaN(last) || last >= start);
      });
      if (matches.length === 1) number = matches[0].primaryNumber!;
    }
  } catch {
    return null; // try again next time; don't cache a network failure
  }
  await kv.set(numberKey(sport, player.id), number ?? '');
  return number;
}

export interface CardCheck {
  streak: number;
  next: ReturnType<typeof nextMilestone>;
  card: StreakCard | null;
}

/** After a saved Daily: the streak, the next milestone, and a card if this day earned one. */
export async function checkStreakCard(userId: string, sport: Sport, date: string, picks: PickRecord[]): Promise<CardCheck> {
  const streak = await dailyStreak(userId, sport, date);
  const next = nextMilestone(sport, streak);
  const milestone = CARD_MILESTONES[sport].find((m) => m.days === streak);
  if (!milestone) return { streak, next, card: null };

  // One card per milestone per streak (a second variant the same day doesn't mint another).
  const awardKey = `${sport}:${milestone.days}:${date}`;
  const fresh = await kv.hsetnx(`${cardsKey(userId)}:awarded`, awardKey, Date.now());
  if (!fresh) return { streak, next, card: null };

  const { data, config } = getDataset(sport);
  const lineup = picks
    .map((p) => ({ pick: p, player: poolPlayers(data, p.spin, config).find((pl) => pl.id === p.playerId) }))
    .filter((x): x is { pick: PickRecord; player: Player } => !!x.player)
    .sort((a, b) => b.player.score - a.player.score);
  const best = lineup[0];
  if (!best) return { streak, next, card: null };

  const franchise = data.franchises.find((f) => f.id === best.pick.spin.franchise);
  const card: StreakCard = {
    id: crypto.randomUUID(),
    sport,
    tier: milestone.tier,
    milestone: milestone.days,
    date,
    earnedAt: Date.now(),
    player: {
      id: best.player.id,
      name: best.player.name,
      pos: best.player.pos,
      number: await jerseyNumber(sport, best.player, best.pick.spin.decade),
      franchiseId: best.pick.spin.franchise,
      franchiseName: franchise?.names[best.pick.spin.decade] ?? best.pick.spin.franchise,
      decade: best.pick.spin.decade,
      line: best.player.line,
    },
  };
  await kv.hset(cardsKey(userId), { [card.id]: card });
  await kv.set(cardRefKey(card.id), userId);
  return { streak, next, card };
}

/** All of a user's cards, newest first. */
export async function getUserCards(userId: string): Promise<StreakCard[]> {
  const all = (await kv.hgetall<Record<string, StreakCard>>(cardsKey(userId))) ?? {};
  return Object.values(all).sort((a, b) => b.earnedAt - a.earnedAt);
}

/** Remove every card (account deletion). */
export async function deleteUserCards(userId: string): Promise<void> {
  const ids = (await kv.hkeys(cardsKey(userId))) ?? [];
  if (ids.length) await kv.del(...ids.map((id) => cardRefKey(id)));
  await kv.del(cardsKey(userId), `${cardsKey(userId)}:awarded`);
}
