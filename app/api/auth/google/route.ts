import { NextRequest, NextResponse } from 'next/server';
import { authorizeUrl, googleEnabled, safeNext, startState, GOOGLE_STATE_COOKIE } from '@/lib/perfectseason/server/google';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';

/** Start Sign in with Google: remember state + PKCE verifier, send the browser to Google. */
export async function GET(request: NextRequest) {
  if (!googleEnabled()) return NextResponse.json({ error: 'Google sign-in is not set up' }, { status: 404 });
  if (!(await rateLimit(`ps:rl:google:${clientIp(request)}`, 30, 3600))) {
    return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  }
  const { state, verifier, challenge } = startState();
  const next = safeNext(request.nextUrl.searchParams.get('next'));
  const res = NextResponse.redirect(authorizeUrl(request.nextUrl.origin, state, challenge));
  res.cookies.set(GOOGLE_STATE_COOKIE, JSON.stringify({ state, verifier, next }), {
    path: '/api/auth',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
  });
  return res;
}
