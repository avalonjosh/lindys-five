import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';
import { easternDateString } from '@/lib/perfectseason/seed';
import { userKey, type User } from '@/lib/perfectseason/leaderboard';
import {
  whatIfSaveKey,
  whatIfAllKey,
  whatIfTeamKey,
  whatIfGlobalMember,
  parseWhatIfGlobalMember,
  type WhatIfSave,
} from '@/lib/whatif/types';

export interface AdminWhatIfRow {
  userId: string;
  username: string;
  email: string;
  sport: string;
  teamId: string;
  season: string;
  savedDate: string;
  savedAt: number;
  label?: string;
  backdated?: boolean;
  summary: WhatIfSave['summary'] | null;
  picks: WhatIfSave['picks'];
}

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const sport = searchParams.get('sport') || 'nhl';
  const team = searchParams.get('team') || '';
  const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 50, 1), 200);

  // Newest-first members of the global index. Volume is one member per
  // user/team/day, so reading the whole set stays cheap.
  const allMembers = await kv.zrange<string[]>(whatIfAllKey(), 0, -1, { rev: true });
  const parsed = allMembers
    .map(parseWhatIfGlobalMember)
    .filter((m): m is NonNullable<ReturnType<typeof parseWhatIfGlobalMember>> => m !== null);

  const today = easternDateString();
  const uniqueUsers = new Set(parsed.map((m) => m.userId));
  const teamCounts: Record<string, number> = {};
  for (const m of parsed) {
    const k = `${m.sport}:${m.teamId}`;
    teamCounts[k] = (teamCounts[k] || 0) + 1;
  }

  const filtered = parsed.filter((m) => m.sport === sport && (!team || m.teamId === team));
  const page = filtered.slice(0, limit);

  let rows: AdminWhatIfRow[] = [];
  if (page.length > 0) {
    const saveKeys = page.map((m) => whatIfSaveKey(m.userId, m.sport, m.teamId, m.season, m.savedDate));
    const userIds = Array.from(new Set(page.map((m) => m.userId)));
    const [saves, users] = await Promise.all([
      kv.mget<(WhatIfSave | null)[]>(...saveKeys),
      kv.mget<(User | null)[]>(...userIds.map((id) => userKey(id))),
    ]);
    const userById = new Map(userIds.map((id, i) => [id, users[i]]));
    rows = page.map((m, i) => {
      const save = saves[i];
      const user = userById.get(m.userId);
      return {
        userId: m.userId,
        username: user?.username || 'unknown',
        email: user?.email || '',
        sport: m.sport,
        teamId: m.teamId,
        season: m.season,
        savedDate: m.savedDate,
        savedAt: save?.savedAt || 0,
        ...(save?.label ? { label: save.label } : {}),
        ...(save?.backdated ? { backdated: true } : {}),
        summary: save?.summary || null,
        picks: save?.picks || [],
      };
    });
  }

  return NextResponse.json({
    stats: {
      totalSaves: parsed.length,
      uniqueUsers: uniqueUsers.size,
      savesToday: parsed.filter((m) => m.savedDate === today).length,
      teamCounts,
    },
    saves: rows,
  });
}

/**
 * One-time backfill: index every existing `whatif:save:*` record into the
 * global + per-team sorted sets. Idempotent — re-running just re-scores.
 */
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keys: string[] = [];
  let cursor: string | number = 0;
  do {
    const [next, batch]: [string | number, string[]] = await kv.scan(cursor, {
      match: 'whatif:save:*',
      count: 200,
    });
    keys.push(...batch);
    cursor = next;
  } while (String(cursor) !== '0');

  let indexed = 0;
  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    const saves = await kv.mget<(WhatIfSave | null)[]>(...chunk);
    for (const save of saves) {
      if (!save) continue;
      const member = whatIfGlobalMember(save.userId, save.sport, save.teamId, save.season, save.savedDate);
      await Promise.all([
        kv.zadd(whatIfAllKey(), { score: save.savedAt, member }),
        kv.zadd(whatIfTeamKey(save.sport, save.teamId), { score: save.savedAt, member }),
      ]);
      indexed++;
    }
  }

  return NextResponse.json({ scanned: keys.length, indexed });
}
