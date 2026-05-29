import { NextRequest, NextResponse } from 'next/server';
import { verifyAdmin } from '@/lib/utils/adminAuth';
import { lockWindow } from '@/lib/pickthebills/windows';

// Manually lock a window.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const window = await lockWindow(id);
    if (!window) {
      return NextResponse.json({ error: 'Window not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, window });
  } catch (error) {
    console.error('Lock window failed:', error);
    return NextResponse.json({ error: 'Failed to lock window' }, { status: 500 });
  }
}
