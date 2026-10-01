// Heavy route (batch email sends) — allow up to 5 minutes
export const maxDuration = 300;

import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import { NHL_TEAMS } from '@/lib/teamConfig';
import { getCurrentNHLSeason } from '@/lib/utils/season';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import { getVerifiedSubscribersForTeam, renderClinchEmail, sendMomentEmail } from '@/lib/email';
import type { StandingsTeam } from '@/lib/types/boxscore';

// Off by default — real sends to subscribers only once this flag is set true.
// Runs daily; each team gets one clinch email per season (its first clinch).
const ENABLED_KEY = 'blog:settings:clinch-enabled';
const CLINCHED = new Set(['x', 'y', 'z', 'p']);

const ticketsFor = (slug: string) => {
  const t = NHL_TEAMS[slug];
  return t ? generateTeamTicketsLink(t.slug, t.city, t.stubhubId, 'email-clinch') : undefined;
};
const subjectFor = (slug: string) => `The ${NHL_TEAMS[slug]?.name ?? ''} clinched a playoff spot!`;

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const previewTeam = params.get('team') || 'sabres';
  const previewClinch = params.get('clinch') || 'x';

  if (params.get('preview') === '1') {
    const html = renderClinchEmail(previewTeam, previewClinch, '#', ticketsFor(previewTeam));
    if (!html) return NextResponse.json({ error: `unknown team ${previewTeam}` }, { status: 400 });
    return new NextResponse(html, { headers: { 'Content-Type': 'text/html' } });
  }

  const testEmail = params.get('test');
  if (testEmail) {
    const { sent } = await sendMomentEmail([], subjectFor(previewTeam), 'clinch', previewTeam,
      (unsub) => renderClinchEmail(previewTeam, previewClinch, unsub, ticketsFor(previewTeam)) ?? '', { testEmail });
    return NextResponse.json({ test: true, to: testEmail, team: previewTeam, sent });
  }

  const enabled = await kv.get<boolean>(ENABLED_KEY);
  if (!enabled) return NextResponse.json({ skipped: 'clinch disabled', hint: `set KV ${ENABLED_KEY}=true to enable` });

  const data = await fetchJsonWithRetry('https://api-web.nhle.com/v1/standings/now');
  const standings = (data.standings || []) as StandingsTeam[];
  const season = getCurrentNHLSeason();
  const results: { team: string; status: string; sent?: number }[] = [];

  for (const standing of standings) {
    const clinch = standing.clinchIndicator;
    if (!clinch || !CLINCHED.has(clinch)) continue;
    const slug = Object.values(NHL_TEAMS).find((t) => t.abbreviation === standing.teamAbbrev?.default)?.slug;
    if (!slug) continue;
    const subscribers = await getVerifiedSubscribersForTeam(slug, 'specials');
    if (subscribers.length === 0) continue;
    const claimKey = `email:clinch-sent:${slug}:${season}`;
    if (!(await kv.set(claimKey, true, { nx: true }))) continue;
    try {
      const { sent } = await sendMomentEmail(subscribers, subjectFor(slug), 'clinch', slug,
        (unsub) => renderClinchEmail(slug, clinch, unsub, ticketsFor(slug)) ?? '');
      results.push({ team: slug, status: 'sent', sent });
    } catch (err) {
      await kv.del(claimKey);
      console.error(`Clinch email failed for ${slug}:`, err);
      results.push({ team: slug, status: 'error' });
    }
  }
  return NextResponse.json({ results });
}
