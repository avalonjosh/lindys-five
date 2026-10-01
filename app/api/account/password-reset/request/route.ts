import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';
import { createResetToken, resetUrl } from '@/lib/perfectseason/server/passwordReset';
import { userKey, userEmailKey, userNameKey, type User } from '@/lib/perfectseason/leaderboard';
import { sendPasswordResetEmail } from '@/lib/email';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';

// Same answer whether or not the account exists, so this can't be used to
// check who has an account.
const SENT = { message: "If there's an account for that, we've sent a reset link. It expires in 1 hour." };

export async function POST(request: NextRequest) {
  let body: { emailOrUsername?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const id = (body.emailOrUsername ?? '').trim();
  if (!id || id.length > 200) return NextResponse.json({ error: 'Enter your email or username' }, { status: 400 });

  if (!(await rateLimit(`ps:rl:pwreset:ip:${clientIp(request)}`, 10, 3600))) {
    return NextResponse.json({ error: 'Too many reset requests. Try again later.' }, { status: 429 });
  }

  const userId = await kv.get<string>(id.includes('@') ? userEmailKey(id) : userNameKey(id));
  const user = userId ? await kv.get<User>(userKey(userId)) : null;
  if (!user) return NextResponse.json(SENT);

  // Per-account cap so nobody can flood someone's inbox; silently stop sending.
  if (!(await rateLimit(`ps:rl:pwreset:user:${user.id}`, 3, 3600))) return NextResponse.json(SENT);

  const link = resetUrl(SITE_URL, await createResetToken(user.id));
  if (process.env.NODE_ENV !== 'production') console.log(`[password reset] ${user.email}: ${link.replace(SITE_URL, request.nextUrl.origin)}`);
  try {
    await sendPasswordResetEmail(user.email, link);
  } catch (err) {
    console.error('Password reset email failed:', err);
    return NextResponse.json({ error: "We couldn't send the email right now. Try again in a few minutes." }, { status: 500 });
  }
  return NextResponse.json(SENT);
}
