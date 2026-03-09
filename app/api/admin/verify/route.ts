import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

export async function GET(request: NextRequest) {
  try {
    // Get the token from the cookie
    const token = request.cookies.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { error: 'Not authenticated', authenticated: false },
        { status: 401 }
      );
    }

    // Verify the JWT
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);

    const { payload } = await jwtVerify(token, secret);

    // Token is valid
    return NextResponse.json({
      authenticated: true,
      user: payload.sub,
    });
  } catch (error) {
    console.error('Auth verification error:', error);

    // Token is invalid or expired
    return NextResponse.json(
      {
        error: 'Invalid or expired token',
        authenticated: false,
      },
      { status: 401 }
    );
  }
}
