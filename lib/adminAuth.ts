import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

/**
 * Verify the admin JWT cookie on an API request.
 * Shared by all admin-gated API routes.
 */
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
