import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/utils/adminAuth';
import { createWindow } from '@/lib/pickthebills/windows';

const VALID_TYPES = ['baseline', 'scheduled', 'event'] as const;

// Create a new (open) window. Locks any existing open window first.
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { label, type, locksAt } = await request.json();

  if (!label || typeof label !== 'string') {
    return NextResponse.json({ error: 'A label is required' }, { status: 400 });
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: 'Invalid type', validTypes: VALID_TYPES }, { status: 400 });
  }

  let parsedLocksAt: Date | undefined;
  if (locksAt) {
    parsedLocksAt = new Date(locksAt);
    if (Number.isNaN(parsedLocksAt.getTime())) {
      return NextResponse.json({ error: 'Invalid locks_at date' }, { status: 400 });
    }
  }

  try {
    const result = await createWindow({ label, type, locksAt: parsedLocksAt }, new Date());
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, window: result.window });
  } catch (error) {
    console.error('Create window failed:', error);
    return NextResponse.json({ error: 'Failed to create window' }, { status: 500 });
  }
}
