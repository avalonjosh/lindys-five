import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { getAllSubscribers, sendWeeklyDigest, renderWeeklyDigestEmail, type WeeklyDigestContent } from '@/lib/email';
import { getPublishedPosts } from '@/lib/kv';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';
// Off by default — the weekly blast only goes out once this KV flag is set true.
const ENABLED_KEY = 'blog:settings:weekly-digest-enabled';

async function buildContent(): Promise<WeeklyDigestContent> {
  let latestPost: WeeklyDigestContent['latestPost'];
  try {
    const posts = await getPublishedPosts();
    const p = posts[0];
    if (p) {
      latestPost = {
        title: p.title,
        url: `${SITE_URL}/blog/${p.team}/${p.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=weekly-digest&utm_content=blog`,
      };
    }
  } catch {
    /* blog optional */
  }
  return { latestPost };
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const content = await buildContent();

  // Preview: return the rendered HTML, no send. (?preview=1)
  if (params.get('preview') === '1') {
    return new NextResponse(renderWeeklyDigestEmail(content, '#'), { headers: { 'Content-Type': 'text/html' } });
  }

  // Test: send a single email to the given address only. (?test=you@email.com)
  const testEmail = params.get('test');
  if (testEmail) {
    const { sent } = await sendWeeklyDigest([], content, { testEmail });
    return NextResponse.json({ test: true, to: testEmail, sent });
  }

  // Real broadcast — only when explicitly enabled.
  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) {
    return NextResponse.json({ skipped: 'weekly-digest disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });
  }
  const subscribers = await getAllSubscribers();
  const { sent } = await sendWeeklyDigest(subscribers, content);
  return NextResponse.json({ sent });
}
