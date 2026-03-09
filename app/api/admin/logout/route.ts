import { NextRequest, NextResponse } from 'next/server';

export async function POST(_request: NextRequest) {
  // Clear the admin token cookie
  const response = NextResponse.json({
    success: true,
    message: 'Logged out successfully',
  });

  response.cookies.set('admin_token', '', {
    path: '/',
    httpOnly: true,
    sameSite: 'strict',
    maxAge: 0,
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}
