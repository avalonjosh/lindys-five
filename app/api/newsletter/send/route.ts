import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { getPostBySlug } from '@/lib/kv';
import { sendGameRecapNewsletter, sendSetRecapNewsletter, sendBoxscoreRecapForTeam, sendSetRecapForTeam, getVerifiedSubscribersForTeam } from '@/lib/email';
import { TEAMS } from '@/lib/teamConfig';

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

export async function POST(request: NextRequest) {
  // Allow admin or cron auth
  const authHeader = request.headers.get('authorization');
  const isCron = authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isAdmin = await verifyAdmin(request);

  if (!isCron && !isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { slug, team, type } = body;

    // Team-based send
    if (team) {
      if (!TEAMS[team]) {
        return NextResponse.json({ error: 'Invalid team' }, { status: 400 });
      }

      const subscribers = await getVerifiedSubscribersForTeam(team);
      if (subscribers.length === 0) {
        return NextResponse.json({ error: `No verified subscribers for ${team}` }, { status: 400 });
      }

      if (type === 'set-recap') {
        await sendSetRecapForTeam(team, subscribers);
        return NextResponse.json({
          success: true,
          message: `Set recap sent to ${subscribers.length} ${TEAMS[team].name} subscriber(s)`,
        });
      } else {
        await sendBoxscoreRecapForTeam(team, subscribers);
        return NextResponse.json({
          success: true,
          message: `Game recap sent to ${subscribers.length} ${TEAMS[team].name} subscriber(s)`,
        });
      }
    }

    // Blog post-based send (legacy)
    if (slug) {
      const post = await getPostBySlug(slug);
      if (!post) {
        return NextResponse.json({ error: 'Post not found' }, { status: 404 });
      }

      if (post.status !== 'published') {
        return NextResponse.json({ error: 'Post must be published before sending' }, { status: 400 });
      }

      if (post.type === 'set-recap') {
        await sendSetRecapNewsletter(post);
      } else {
        await sendGameRecapNewsletter(post);
      }

      return NextResponse.json({ success: true, message: `Newsletter sent for "${post.title}"` });
    }

    return NextResponse.json({ error: 'Either team or slug is required' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Newsletter send error:', error);
    return NextResponse.json({ error: 'Failed to send newsletter' }, { status: 500 });
  }
}
