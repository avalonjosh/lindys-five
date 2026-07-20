import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { rateLimit } from '@/lib/perfectseason/server/ratelimit';
import { easternDateString } from '@/lib/perfectseason/seed';
import { NHL_TEAMS } from '@/lib/teamConfig';
import {
  whatIfSaveKey,
  whatIfIndexKey,
  whatIfIndexMember,
  type WhatIfSave,
  type WhatIfSubmission,
} from '@/lib/whatif/types';

const OUTCOMES = new Set(['W', 'OTL', 'L']);
const SEASON_RE = /^\d{8}$/;
const MAX_PICKS = 84;

function validate(sub: WhatIfSubmission): string | null {
  if (sub.sport !== 'nhl') return 'Unsupported sport';
  if (!NHL_TEAMS[sub.teamId]) return 'Unknown team';
  if (!SEASON_RE.test(sub.season)) return 'Invalid season';
  if (!Array.isArray(sub.picks) || sub.picks.length === 0) return 'No picks to save';
  if (sub.picks.length > MAX_PICKS) return 'Too many picks';
  const seen = new Set<number>();
  for (const p of sub.picks) {
    if (typeof p.gameId !== 'number' || !Number.isFinite(p.gameId)) return 'Invalid pick';
    if (seen.has(p.gameId)) return 'Duplicate pick';
    seen.add(p.gameId);
    if (!OUTCOMES.has(p.outcome)) return 'Invalid pick';
    if (typeof p.date !== 'string' || typeof p.opponentAbbrev !== 'string' || typeof p.isHome !== 'boolean') {
      return 'Invalid pick';
    }
  }
  if (!sub.summary || typeof sub.summary !== 'object') return 'Missing summary';
  return null;
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

  // The locked date is always the server's idea of today (Eastern), never the client's.
  const savedDate = easternDateString();
  const key = whatIfSaveKey(userId, sub.sport, sub.teamId, sub.season, savedDate);
  const replacedToday = (await kv.exists(key)) === 1;

  const save: WhatIfSave = {
    userId,
    sport: sub.sport,
    teamId: sub.teamId,
    season: sub.season,
    savedDate,
    savedAt: Date.now(),
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
