import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { submitPicks } from '@/lib/pickthebills/picks';
import { getEffectivePicks } from '@/lib/pickthebills/queries';

// Submit (or claim) picks. Login required. Resolves the open window server-side
// and enforces the per-game kickoff guard regardless of stale client state.
export async function POST(request: NextRequest) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Sign in to save your picks' }, { status: 401 });
  }

  let body: { picks?: unknown; confirmOverwrite?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!Array.isArray(body.picks)) {
    return NextResponse.json({ error: 'picks must be an array' }, { status: 400 });
  }

  const result = await submitPicks(userId, body.picks, body.confirmOverwrite === true, new Date());
  if (result.requiresConfirmation) {
    return NextResponse.json(result, { status: 409 });
  }
  if (!result.ok) {
    return NextResponse.json(result, { status: 400 });
  }
  return NextResponse.json(result);
}

// Current user's effective picks, for prefilling the pick screen.
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const effective = await getEffectivePicks(userId);
  return NextResponse.json({ picks: effective });
}
