import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Server-side gate for the admin area. Previously the admin HTML shell was
 * served to anyone (auth was a client-side wrapper only, with the API routes
 * as the real line of defense) — now unauthenticated requests never receive
 * the admin pages at all.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get('admin_token')?.value;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
      await jwtVerify(token, secret);
      return NextResponse.next();
    } catch {
      /* fall through to redirect */
    }
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = '/admin/login';
  loginUrl.search = '';
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/admin'],
};
