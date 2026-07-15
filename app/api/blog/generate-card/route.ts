import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { generateAndUploadOgImage } from '@/lib/utils/ogImage';
import { TEAMS } from '@/lib/teamConfig';

// Helper to verify admin authentication
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

// POST - generate a rights-safe featured image card for a post (admin only)
// Body: { title: string, team: string }
export async function POST(request: NextRequest) {
  const isAdmin = await verifyAdmin(request);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { title, team } = await request.json();

  if (!title || !team) {
    return NextResponse.json({ error: 'Missing required fields: title, team' }, { status: 400 });
  }

  try {
    const teamAbbrev = team === 'bills' ? 'BILLS' : TEAMS[team]?.abbreviation || 'BUF';
    const slugBase = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
    const imageSlug = `card-${slugBase}-${Date.now()}`;

    const url = await generateAndUploadOgImage({
      type: 'news-analysis',
      teamAbbrev,
      headline: title,
    }, imageSlug);

    return NextResponse.json({ success: true, url });
  } catch (error: any) {
    console.error('Error generating card image:', error);
    return NextResponse.json({ error: 'Failed to generate card image', details: error.message }, { status: 500 });
  }
}
