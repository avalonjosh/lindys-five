import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { jwtVerify } from 'jose';

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
    let imported = 0;
    let skipped = 0;

    for (const c of contacts) {
      const id = c.id || `outreach-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Check if already exists
      const existing = await kv.get(`outreach:contact:${id}`);
      if (existing) {
        skipped++;
        continue;
      }

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

      await kv.set(`outreach:contact:${id}`, contact);
      await kv.sadd('outreach:contacts', id);
      imported++;
    }

    return NextResponse.json({ imported, skipped, total: contacts.length });
  } catch (error) {
    console.error('Error importing outreach contacts:', error);
    return NextResponse.json({ error: 'Failed to import contacts' }, { status: 500 });
  }
}
