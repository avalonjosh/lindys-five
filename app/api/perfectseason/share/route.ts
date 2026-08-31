import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { shareKey, type SharedTeam } from '@/lib/perfectseason/share';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';

const SHARE_TTL_SECONDS = 180 * 24 * 60 * 60; // shares are ephemeral by nature
const MAX_STRING_LENGTH = 100;

function isShortString(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MAX_STRING_LENGTH;
}

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
  if (!Number.isFinite(team.wins) || !Number.isFinite(team.losses)) return false;
  if (!Number.isFinite(team.rating) || !isShortString(team.grade)) return false;
  if (!Array.isArray(team.rows) || team.rows.length < 1 || team.rows.length > 12) return false;
  return team.rows.every((r) => {
    const row = r as Record<string, unknown>;
    return (
      isShortString(row.slot) &&
      isShortString(row.playerName) &&
      isShortString(row.franchiseId) &&
      isShortString(row.decade) &&
      (row.franchise === undefined || isShortString(row.franchise))
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

  if (!(await rateLimit(`ps:rl:share:${clientIp(request)}`, 20, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  // Store a whitelist copy so unvalidated or extra fields can't smuggle in
  // arbitrarily large payloads.
  const clean: SharedTeam = {
    sport: team.sport,
    variant: team.variant === 'blind' ? 'blind' : 'classic',
    modeType: team.modeType === 'tank' || team.modeType === 'franchise' ? team.modeType : 'standard',
    source: team.source === 'free' ? 'free' : 'daily',
    wins: team.wins,
    losses: team.losses,
    rating: team.rating,
    grade: team.grade,
    tier: isShortString(team.tier) ? team.tier : '',
    rows: team.rows.map((r) => ({
      slot: r.slot,
      playerName: r.playerName,
      franchise: isShortString(r.franchise) ? r.franchise : '',
      franchiseId: r.franchiseId,
      decade: r.decade,
    })),
    createdAt: Number.isFinite(team.createdAt) ? team.createdAt : Date.now(),
  };

  const id = genShareId();
  await kv.set(shareKey(id), clean, { ex: SHARE_TTL_SECONDS });

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
