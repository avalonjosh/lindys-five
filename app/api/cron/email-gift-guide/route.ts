// Heavy route (batch email sends) — allow up to 5 minutes
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { ALL_TEAMS, findTeam } from '@/lib/teamConfig';
import { getVerifiedSubscribersForTeam, renderGiftGuideEmail, nextHomeGameFor, sendMomentEmail } from '@/lib/email';

// Off by default — real sends to subscribers only once this flag is set true.
// Scheduled once a year (the week of Black Friday); sends once per team per year.
const ENABLED_KEY = 'blog:settings:gift-guide-enabled';

const subjectFor = (slug: string) => `The ${findTeam(slug)?.name ?? ''} holiday gift guide`;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const previewTeam = params.get('team') || 'sabres';

  if (params.get('preview') === '1') {
    const html = renderGiftGuideEmail(previewTeam, '#', await nextHomeGameFor(previewTeam, 'email-gift-guide'));
    if (!html) return NextResponse.json({ error: `unknown team ${previewTeam}` }, { status: 400 });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }

  const testEmail = params.get('test');
  if (testEmail) {
    const homeGame = await nextHomeGameFor(previewTeam, 'email-gift-guide');
    const { sent } = await sendMomentEmail([], subjectFor(previewTeam), 'gift-guide', previewTeam,
      (unsub) => renderGiftGuideEmail(previewTeam, unsub, homeGame) ?? '', { testEmail });
    return NextResponse.json({ test: true, to: testEmail, team: previewTeam, sent });
  }

  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) return NextResponse.json({ skipped: 'gift-guide disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });

  const year = new Date().getFullYear();
  const results: { team: string; status: string; sent?: number }[] = [];
  for (const slug of Object.keys(ALL_TEAMS)) {
    const subscribers = await getVerifiedSubscribersForTeam(slug);
    if (subscribers.length === 0) continue;
    const claimKey = `email:gift-guide-sent:${slug}:${year}`;
    if (!(await kv.set(claimKey, true, { nx: true }))) {
      results.push({ team: slug, status: 'already-sent' });
      continue;
    }
    try {
      const homeGame = await nextHomeGameFor(slug, 'email-gift-guide');
      const { sent } = await sendMomentEmail(subscribers, subjectFor(slug), 'gift-guide', slug,
        (unsub) => renderGiftGuideEmail(slug, unsub, homeGame) ?? '');
      results.push({ team: slug, status: 'sent', sent });
    } catch (err) {
      await kv.del(claimKey);
      console.error(`Gift guide failed for ${slug}:`, err);
      results.push({ team: slug, status: 'error' });
    }
  }
  return NextResponse.json({ results });
}
