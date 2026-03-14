import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';
import { quickFactCheck } from '@/lib/factCheck';
import { sendGameRecapNewsletter } from '@/lib/email';
import { TEAMS } from '@/lib/teamConfig';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

const SERIES_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing an NHL playoff series recap for "Lindy's Five", a hockey analytics site.

Write an engaging series summary based ONLY on the verified data provided. 600-900 words in Markdown with ## headers and **bold** for names/stats.

Structure: Series result lead → how the series unfolded (key turning points, game-by-game narrative) → standout performers across the series → what's next for the winning team.

ACCURACY RULES:
- Use ONLY data from the VERIFIED SERIES DATA block. Every score, stat, and player name must appear in the data.
- Never invent quotes, atmosphere, or details not in the data.
- Focus on the narrative arc of the series — momentum shifts, elimination games, dominant performances.`;

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Stanley Cup Final',
};

const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

async function generateUniqueSlug(title: string, maxAttempts: number = 10) {
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;
  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) return baseSlug;
  for (let i = 2; i <= maxAttempts + 1; i++) {
    const s = `${baseSlug}-${i}`;
    if (!(await kv.get(`blog:slug:${s}`))) return s;
  }
  return `${baseSlug}-${Date.now()}`;
}

async function createPost(postData: any) {
  const now = new Date().toISOString();
  const slug = await generateUniqueSlug(postData.title);
  const plainText = postData.content.replace(/#{1,6}\s/g, '').replace(/\*\*|__/g, '').replace(/\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');
  const id = crypto.randomUUID();

  const post = {
    id, slug, title: postData.title, content: postData.content, excerpt,
    team: postData.team, type: postData.type, status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    aiGenerated: true, aiModel: postData.aiModel, metaDescription: postData.metaDescription,
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd(`blog:posts:${post.team}`, { score, member: id });
  await kv.zadd(`blog:posts:type:${post.type}`, { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);
  return post;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const bracketRes = await fetchJsonWithRetry(`${NHL_API_BASE}/playoff-bracket/20252026`);
    if (!bracketRes?.rounds || bracketRes.rounds.length === 0) {
      return NextResponse.json({ success: true, message: 'No playoff bracket data available', seriesProcessed: 0 });
    }

    const results: any[] = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('series-recap');

    for (const round of bracketRes.rounds) {
      for (const series of round.series || []) {
        const topWins = series.topSeedWins || 0;
        const bottomWins = series.bottomSeedWins || 0;

        // Only process completed series (one team has 4 wins)
        if (topWins < 4 && bottomWins < 4) continue;

        const seriesKey = `${series.seriesLetter}-R${round.roundNumber}`;
        const processed = await kv.sismember('blog:series-recap:processed', seriesKey);
        if (processed) continue;

        const topTeam = series.matchupTeams?.find((t: any) => t.seed?.isTop);
        const bottomTeam = series.matchupTeams?.find((t: any) => !t.seed?.isTop);
        if (!topTeam || !bottomTeam) continue;

        const winner = topWins >= 4 ? topTeam : bottomTeam;
        const loser = topWins >= 4 ? bottomTeam : topTeam;
        const winnerAbbrev = winner.team.abbrev;
        const loserAbbrev = loser.team.abbrev;
        const winnerName = winner.team.commonName?.default || winner.team.name?.default || winnerAbbrev;
        const loserName = loser.team.commonName?.default || loser.team.name?.default || loserAbbrev;
        const finalScore = topWins >= 4 ? `${topWins}-${bottomWins}` : `${bottomWins}-${topWins}`;

        // Fetch box scores for all games in the series
        const gameResults: string[] = [];
        for (const game of series.games || []) {
          if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') continue;
          try {
            const landing = await fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${game.id}/landing`);
            const homeAbbrev = landing?.homeTeam?.abbrev || '?';
            const awayAbbrev = landing?.awayTeam?.abbrev || '?';
            const homeScore = landing?.homeTeam?.score || 0;
            const awayScore = landing?.awayTeam?.score || 0;
            const ot = landing?.gameOutcome?.lastPeriodType === 'OT' ? ' (OT)' : '';
            const stars = (landing?.summary?.threeStars || [])
              .map((s: any, i: number) => `${i + 1}. ${s.name?.default || '?'}`)
              .join(', ');
            gameResults.push(`Game ${gameResults.length + 1}: ${awayAbbrev} ${awayScore} @ ${homeAbbrev} ${homeScore}${ot}${stars ? ` | Stars: ${stars}` : ''}`);
          } catch {
            gameResults.push(`Game ${gameResults.length + 1}: Score unavailable`);
          }
        }

        const roundLabel = ROUND_LABELS[round.roundNumber] || `Round ${round.roundNumber}`;
        const verifiedData = `
═══════════════════════════════════════════════════════
VERIFIED SERIES DATA
${roundLabel}: ${winnerName} vs ${loserName}
Source: Official NHL API
═══════════════════════════════════════════════════════

SERIES RESULT: ${winnerName} win ${finalScore}
${winnerName} advance to the ${round.roundNumber === 4 ? 'championship' : 'next round'}.

GAME-BY-GAME RESULTS:
${gameResults.join('\n')}

═══════════════════════════════════════════════════════
`;

        try {
          const message = await anthropic.messages.create({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: [{ type: 'text' as const, text: SERIES_RECAP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } }],
            messages: [{ role: 'user', content: `Write a series recap based on the following verified data:\n\n${verifiedData}\n\nThe article should be 600-900 words.` }],
          });

          const content = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
          const factCheck = await quickFactCheck(anthropic, content, verifiedData);
          const shouldPublish = autoPublish && factCheck.passed;

          const sweepOrLength = topWins + bottomWins <= 4 ? 'Sweep' :
            topWins + bottomWins <= 5 ? `Win in ${topWins + bottomWins}` :
            topWins + bottomWins <= 6 ? `Win in ${topWins + bottomWins}` :
            'Win in 7';
          const title = `${winnerName} ${sweepOrLength} Over ${loserName} — ${roundLabel}`;
          const metaDescription = `${roundLabel} recap: ${winnerName} defeat ${loserName} ${finalScore}. Full series breakdown and analysis.`;

          const teamSlug = abbrevToSlug[winnerAbbrev] || abbrevToSlug[loserAbbrev] || 'sabres';

          const post = await createPost({
            title, content, team: teamSlug, type: 'series-recap',
            status: shouldPublish ? 'published' : 'draft',
            gameDate: new Date().toISOString().split('T')[0], metaDescription,
            aiModel: 'claude-sonnet-4-20250514',
          });

          await kv.sadd('blog:series-recap:processed', seriesKey);
          await kv.set(`blog:series-recap:log:${seriesKey}`, {
            processedAt: new Date().toISOString(), postId: post.id,
            matchup: `${winnerAbbrev} vs ${loserAbbrev}`, result: finalScore,
          });

          if (post.status === 'published') {
            try {
              await sendGameRecapNewsletter(post);
            } catch (emailError) {
              console.error(`Failed to send series recap newsletter for ${seriesKey}:`, emailError);
            }
          }

          results.push({ seriesKey, postId: post.id, title: post.title, status: post.status });
        } catch (error: any) {
          console.error(`Error processing series ${seriesKey}:`, error);
          results.push({ seriesKey, error: error.message });
        }
      }
    }

    return NextResponse.json({
      success: true,
      seriesProcessed: results.filter(r => !r.error).length,
      results,
    });
  } catch (error: any) {
    console.error('Series recap cron error:', error);
    return NextResponse.json({ error: 'Failed to process series recaps', message: error.message }, { status: 500 });
  }
}
