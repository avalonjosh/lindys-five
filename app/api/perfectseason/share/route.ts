import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { shareKey, type SharedTeam } from '@/lib/perfectseason/share';

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** A short, URL-safe, base62 id (no external dependency). */
function genShareId(len = 16): string {
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < len; i++) out += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return out;
}

/** Reject anything that isn't a plausible shared-team payload before storing it. */
function isValidTeam(t: unknown): t is SharedTeam {
  if (!t || typeof t !== 'object') return false;
  const team = t as Record<string, unknown>;
  if (team.sport !== 'nhl' && team.sport !== 'mlb') return false;
  if (typeof team.wins !== 'number' || typeof team.losses !== 'number') return false;
  if (typeof team.rating !== 'number' || typeof team.grade !== 'string') return false;
  if (!Array.isArray(team.rows) || team.rows.length < 1 || team.rows.length > 12) return false;
  return team.rows.every((r) => {
    const row = r as Record<string, unknown>;
    return (
      typeof row.slot === 'string' &&
      typeof row.playerName === 'string' &&
      typeof row.franchiseId === 'string' &&
      typeof row.decade === 'string'
    );
  });
}

/** Store a built roster and return its short share id. */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const team = (body as { team?: unknown })?.team;
  if (!isValidTeam(team)) {
    return NextResponse.json({ error: 'Invalid team payload' }, { status: 400 });
  }

  const id = genShareId();
  await kv.set(shareKey(id), team);

  return NextResponse.json({ id });
}

/** Fetch a stored shared team by id. */
export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  const team = await kv.get<SharedTeam>(shareKey(id));
  if (!team) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ team });
}
