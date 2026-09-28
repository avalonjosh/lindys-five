import { NextRequest, NextResponse } from 'next/server';
import { ensureSubscriber } from '@/lib/newsletter';
import { findTeam } from '@/lib/teamConfig';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';

/**
 * Lightweight single opt-in used by the in-game "get updates" prompt — captures
 * players who don't make a leaderboard account. With a `team`, they join that
 * team's recap list; without one, the general list (digest and broadcasts).
 * Every send carries an unsubscribe + one-click List-Unsubscribe header.
 */
export async function POST(request: NextRequest) {
  let email: string;
  let source = 'site';
  let teams: string[] = [];
  try {
    const body = await request.json();
    email = String(body.email ?? '').trim();
    if (typeof body.team === 'string' && findTeam(body.team)) teams = [body.team];
    if (typeof body.source === 'string') source = body.source.slice(0, 40).replace(/[^a-z0-9-]/gi, '') || 'site';
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!email.includes('@') || email.length > 200) {
    return NextResponse.json({ error: 'Enter a valid email' }, { status: 400 });
  }

  if (!(await rateLimit(`ps:rl:subscribe:${clientIp(request)}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  try {
    await ensureSubscriber(email, teams, source, { single: true });
  } catch (err) {
    console.error('quick-subscribe failed:', err);
    return NextResponse.json({ error: 'Could not subscribe right now' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
