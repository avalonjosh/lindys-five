import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { verifyAdmin } from '@/lib/adminAuth';

// POST - bulk import contacts from JSON array
export async function POST(request: NextRequest) {
  if (!(await verifyAdmin(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { contacts } = await request.json();
    if (!Array.isArray(contacts)) {
      return NextResponse.json({ error: 'Expected contacts array' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Batch the existence check, then pipeline the writes — no per-contact round trips
    const ids = contacts.map(
      (c) => c.id || `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    );
    const existing = ids.length > 0
      ? await kv.mget<(unknown | null)[]>(...ids.map((id) => `outreach:contact:${id}`))
      : [];

    let imported = 0;
    let skipped = 0;
    const pipeline = kv.pipeline();

    contacts.forEach((c, i) => {
      if (existing[i]) {
        skipped++;
        return;
      }
      const id = ids[i];
      const contact = {
        id,
        name: c.name || '',
        outlet: c.outlet || '',
        type: c.type || 'blog',
        team: c.team || '',
        email: c.email || '',
        twitter: c.twitter || '',
        website: c.website || '',
        notes: c.notes || '',
        status: c.status || 'not_contacted',
        createdAt: now,
        updatedAt: now,
      };
      pipeline.set(`outreach:contact:${id}`, contact);
      pipeline.sadd('outreach:contacts', id);
      imported++;
    });

    if (imported > 0) await pipeline.exec();

    return NextResponse.json({ imported, skipped, total: contacts.length });
  } catch (error) {
    console.error('Error importing outreach contacts:', error);
    return NextResponse.json({ error: 'Failed to import contacts' }, { status: 500 });
  }
}
