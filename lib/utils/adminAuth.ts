import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Shared admin auth check. Verifies the jose JWT in the `admin_token` cookie.
// This is the site operator's auth, separate from the NextAuth end-user system.
export async function verifyAdmin(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get('admin_token')?.value;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}
