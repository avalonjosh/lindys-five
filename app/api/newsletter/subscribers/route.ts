import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getAllSubscribers, getAllSendRecords, deleteSubscriber } from '@/lib/email';

async function verifyAdmin(request: NextRequest): Promise<boolean> {
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

export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const type = request.nextUrl.searchParams.get('type');

    if (type === 'sends') {
      const sends = await getAllSendRecords();
      return NextResponse.json({ sends });
    }

    const subscribers = await getAllSubscribers();
    return NextResponse.json({ subscribers });
  } catch (error: unknown) {
    console.error('Failed to fetch subscribers:', error);
    return NextResponse.json({ error: 'Failed to fetch subscribers' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing subscriber id' }, { status: 400 });
    }

    await deleteSubscriber(id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error('Failed to delete subscriber:', error);
    return NextResponse.json({ error: 'Failed to delete subscriber' }, { status: 500 });
  }
}
