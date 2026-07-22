import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { easternDateString } from '@/lib/perfectseason/seed';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS } from '@/lib/teamConfig';
import {
  whatIfSaveKey,
  whatIfIndexKey,
  whatIfIndexMember,
  type WhatIfSave,
  type WhatIfSubmission,
} from '@/lib/whatif/types';

// Per-sport rules: NHL seasons are "20262027" with W/OTL/L outcomes; MLB and
// NFL seasons are "2026" with W/L only.
const SPORT_RULES = {
  nhl: { teams: NHL_TEAMS, seasonRe: /^\d{8}$/, outcomes: new Set(['W', 'OTL', 'L']), maxPicks: 84 },
  mlb: { teams: MLB_TEAMS, seasonRe: /^\d{4}$/, outcomes: new Set(['W', 'L']), maxPicks: 162 },
  nfl: { teams: NFL_TEAMS, seasonRe: /^\d{4}$/, outcomes: new Set(['W', 'L']), maxPicks: 17 },
} as const;

const MAX_LABEL_LENGTH = 60;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validate(sub: WhatIfSubmission): string | null {
  const rules = SPORT_RULES[sub.sport];
  if (!rules) return 'Unsupported sport';
  if (!rules.teams[sub.teamId]) return 'Unknown team';
  if (!rules.seasonRe.test(sub.season)) return 'Invalid season';
  if (!Array.isArray(sub.picks) || sub.picks.length === 0) return 'No picks to save';
  if (sub.picks.length > rules.maxPicks) return 'Too many picks';
  const seen = new Set<number>();
  for (const p of sub.picks) {
    if (typeof p.gameId !== 'number' || !Number.isFinite(p.gameId)) return 'Invalid pick';
    if (seen.has(p.gameId)) return 'Duplicate pick';
    seen.add(p.gameId);
    if (!rules.outcomes.has(p.outcome)) return 'Invalid pick';
    if (typeof p.date !== 'string' || typeof p.opponentAbbrev !== 'string' || typeof p.isHome !== 'boolean') {
      return 'Invalid pick';
    }
  }
  if (!sub.summary || typeof sub.summary !== 'object') return 'Missing summary';
  if (sub.label !== undefined && typeof sub.label !== 'string') return 'Invalid label';
  if (sub.backdate !== undefined) {
    // Backdating exists to import real pick history (the radio-station use
    // case). NFL only, strictly in the past, and always marked on the save.
    if (sub.sport !== 'nfl') return 'Backdating is only available for NFL picks';
    if (typeof sub.backdate !== 'string' || !DATE_RE.test(sub.backdate)) return 'Invalid backdate';
    if (sub.backdate >= easternDateString()) return 'Backdate must be before today';
  }
  return null;
}

/** Trimmed, control-character-free label, or undefined. */
function cleanLabel(label: unknown): string | undefined {
  if (typeof label !== 'string') return undefined;
  // eslint-disable-next-line no-control-regex
  const cleaned = label.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_LABEL_LENGTH);
  return cleaned.length > 0 ? cleaned : undefined;
}

export async function POST(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to save your picks' }, { status: 401 });

  if (!(await rateLimit(`whatif:rl:save:${userId}`, 60, 3600))) {
    return NextResponse.json({ error: 'Slow down — too many saves' }, { status: 429 });
  }

  let sub: WhatIfSubmission;
  try {
    sub = (await request.json()) as WhatIfSubmission;
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const problem = validate(sub);
  if (problem) return NextResponse.json({ error: problem }, { status: 400 });

  // The locked date is the server's idea of today (Eastern) — unless this is a
  // validated NFL backdate, which records under the claimed past date and is
  // permanently marked as entered-later.
  const backdated = sub.backdate !== undefined;
  const savedDate = backdated ? sub.backdate! : easternDateString();
  const key = whatIfSaveKey(userId, sub.sport, sub.teamId, sub.season, savedDate);
  const replacedToday = (await kv.exists(key)) === 1;

  const label = cleanLabel(sub.label);
  const save: WhatIfSave = {
    userId,
    sport: sub.sport,
    teamId: sub.teamId,
    season: sub.season,
    savedDate,
    savedAt: Date.now(),
    ...(label ? { label } : {}),
    ...(backdated ? { backdated: true } : {}),
    picks: sub.picks,
    summary: {
      gamesPicked: sub.picks.length,
      record: String(sub.summary.record ?? ''),
      projectedPoints: Number(sub.summary.projectedPoints) || 0,
      playoffOdds: Number(sub.summary.playoffOdds) || 0,
      totalPoints: Number(sub.summary.totalPoints) || 0,
      gamesPlayed: Number(sub.summary.gamesPlayed) || 0,
      setsCovered: Array.isArray(sub.summary.setsCovered) ? sub.summary.setsCovered.slice(0, 20) : [],
    },
  };

  await Promise.all([
    kv.set(key, save),
    kv.zadd(whatIfIndexKey(userId), {
      score: save.savedAt,
      member: whatIfIndexMember(sub.sport, sub.teamId, sub.season, savedDate),
    }),
  ]);

  return NextResponse.json({ save, replacedToday });
}

/** Delete one saved pick set (a fun one-off, a mistake). Own saves only. */
export async function DELETE(request: NextRequest) {
  const userId = await getUserId(request);
  if (!userId) return NextResponse.json({ error: 'Sign in to manage your picks' }, { status: 401 });

  let body: { sport?: string; teamId?: string; season?: string; savedDate?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const { sport, teamId, season, savedDate } = body;
  const rules = SPORT_RULES[sport as keyof typeof SPORT_RULES];
  if (!rules || !teamId || !rules.teams[teamId]) return NextResponse.json({ error: 'Unknown team' }, { status: 400 });
  if (!season || !rules.seasonRe.test(season)) return NextResponse.json({ error: 'Invalid season' }, { status: 400 });
  if (!savedDate || !DATE_RE.test(savedDate)) return NextResponse.json({ error: 'Invalid date' }, { status: 400 });

  if (!(await rateLimit(`whatif:rl:delete:${userId}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many deletions. Try again later.' }, { status: 429 });
  }

  const [deleted] = await Promise.all([
    kv.del(whatIfSaveKey(userId, sport!, teamId, season, savedDate)),
    kv.zrem(whatIfIndexKey(userId), whatIfIndexMember(sport!, teamId, season, savedDate)),
  ]);

  return NextResponse.json({ deleted: deleted === 1 });
}
