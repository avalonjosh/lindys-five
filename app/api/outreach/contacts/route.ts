import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';

export interface OutreachContact {
  id: string;
  name: string;
  outlet: string;
  type: 'blog' | 'podcast' | 'beat_writer' | 'radio' | 'tv' | 'other';
  team: string;
  email: string;
  twitter: string;
  website: string;
  notes: string;
  status: 'not_contacted' | 'contacted' | 'responded' | 'converted' | 'declined';
  contactedAt?: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// GET - fetch all contacts (batched read, no per-contact round trips)
export async function GET(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contactIds = await kv.smembers<string[]>('outreach:contacts');
    if (!contactIds || contactIds.length === 0) {
      return NextResponse.json({ contacts: [] });
    }

    const keys = contactIds.map((id) => `outreach:contact:${id}`);
    const records = await kv.mget<(OutreachContact | null)[]>(...keys);
    const contacts = records.filter((c): c is OutreachContact => c !== null);

    contacts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ contacts });
  } catch (error) {
    console.error('Error fetching outreach contacts:', error);
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}

// POST - create or update a contact
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const now = new Date().toISOString();

    const contact: OutreachContact = {
      id: body.id || `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: body.name || '',
      outlet: body.outlet || '',
      type: body.type || 'blog',
      team: body.team || '',
      email: body.email || '',
      twitter: body.twitter || '',
      website: body.website || '',
      notes: body.notes || '',
      status: body.status || 'not_contacted',
      contactedAt: body.contactedAt || undefined,
      respondedAt: body.respondedAt || undefined,
      createdAt: body.createdAt || now,
      updatedAt: now,
    };

    await kv.set(`outreach:contact:${contact.id}`, contact);
    await kv.sadd('outreach:contacts', contact.id);

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Error saving outreach contact:', error);
    return NextResponse.json({ error: 'Failed to save contact' }, { status: 500 });
  }
}

// DELETE - delete a contact
export async function DELETE(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 });
    }

    await kv.del(`outreach:contact:${id}`);
    await kv.srem('outreach:contacts', id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting outreach contact:', error);
    return NextResponse.json({ error: 'Failed to delete contact' }, { status: 500 });
  }
}
