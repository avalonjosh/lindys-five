import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getUserId } from '@/lib/perfectseason/server/session';
import { isValidBoard, lbZKey, lbEntryKey, type LeaderboardEntry, type RankedEntry } from '@/lib/perfectseason/leaderboard';

export async function GET(request: NextRequest, { params }: { params: Promise<{ board: string }> }) {
  const { board: raw } = await params;
  const board = decodeURIComponent(raw);
  if (!isValidBoard(board)) return NextResponse.json({ error: 'Unknown board' }, { status: 400 });

  const limit = Math.min(100, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '50', 10)));
  const zKey = lbZKey(board);

  const userIds = await kv.zrange<string[]>(zKey, 0, limit - 1, { rev: true });
  const entries: RankedEntry[] = [];
  if (userIds && userIds.length > 0) {
    const records = await Promise.all(userIds.map((id) => kv.get<LeaderboardEntry>(lbEntryKey(board, id))));
    records.forEach((rec, i) => {
      if (rec) entries.push({ ...rec, rank: i + 1 });
    });
  }

  // Optionally include the signed-in caller's own rank (even if outside the top N).
  let me: RankedEntry | null = null;
  if (request.nextUrl.searchParams.get('me') === '1') {
    const uid = await getUserId(request);
    if (uid) {
      const rank = await kv.zrevrank(zKey, uid);
      if (rank != null) {
        const rec = await kv.get<LeaderboardEntry>(lbEntryKey(board, uid));
        if (rec) me = { ...rec, rank: rank + 1 };
      }
    }
  }

  return NextResponse.json({ board, entries, me });
}
