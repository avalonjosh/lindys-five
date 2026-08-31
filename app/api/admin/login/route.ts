import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { rateLimit, clientIp } from '@/lib/perfectseason/server/ratelimit';

export async function POST(request: NextRequest) {
  try {
    const { password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }

    // One shared admin password — throttle online brute force per IP
    if (!(await rateLimit(`admin:rl:login:${clientIp(request)}`, 10, 900))) {
      return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
    }

    // Get the stored password hash from environment
    const storedHash = process.env.ADMIN_PASSWORD_HASH;

    if (!storedHash) {
      console.error('ADMIN_PASSWORD_HASH not configured');
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    // Verify the password
    const isValid = await bcrypt.compare(password, storedHash);

    if (!isValid) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
    }

    // Create a JWT token
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);

    const token = await new SignJWT({ sub: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    // Set the token as an HTTP-only cookie
    const response = NextResponse.json({
      success: true,
      message: 'Logged in successfully',
    });

    response.cookies.set('admin_token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
