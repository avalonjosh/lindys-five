import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getPickHistory } from '@/lib/pickthebills/queries';

// Public: one user's full append-only pick history for the timeline view.
export async function GET(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }
  const [user] = await db.select({ displayName: users.displayName }).from(users).where(eq(users.id, userId));
  if (!user) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  const history = await getPickHistory(userId);
  return NextResponse.json({ userId, displayName: user.displayName, history });
}
