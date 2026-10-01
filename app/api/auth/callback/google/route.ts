import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode, findOrCreateGoogleUser, safeNext, GOOGLE_STATE_COOKIE } from '@/lib/perfectseason/server/google';
import { signUserToken, userCookieOptions, USER_COOKIE } from '@/lib/perfectseason/server/session';
import { activateSubscriberByEmail } from '@/lib/newsletter';

/** Google sends the browser back here: check state, get the profile, sign in. */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const fail = (reason: string) => {
    const url = new URL('/account', origin);
    url.searchParams.set('signin', reason);
    const res = NextResponse.redirect(url);
    res.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return res;
  };

  let saved: { state?: string; verifier?: string; next?: string } = {};
  try {
    saved = JSON.parse(request.cookies.get(GOOGLE_STATE_COOKIE)?.value ?? '{}');
  } catch {
    /* treated as missing */
  }
  const params = request.nextUrl.searchParams;
  if (params.get('error')) return fail('cancelled');
  const code = params.get('code');
  if (!code || !saved.state || !saved.verifier || params.get('state') !== saved.state) return fail('expired');

  try {
    const profile = await exchangeCode(origin, code, saved.verifier);
    const { user } = await findOrCreateGoogleUser(profile);
    // Google vouched for this address: switch on any recaps waiting for confirmation.
    try {
      await activateSubscriberByEmail(user.email);
    } catch (err) {
      console.error('Activating held subscription after Google sign-in failed:', err);
    }
    const res = NextResponse.redirect(new URL(safeNext(saved.next), origin));
    res.cookies.set(USER_COOKIE, await signUserToken(user.id), userCookieOptions);
    res.cookies.set(GOOGLE_STATE_COOKIE, '', { path: '/api/auth', maxAge: 0 });
    return res;
  } catch (err) {
    console.error('Google sign-in failed:', err);
    return fail('google');
  }
}
