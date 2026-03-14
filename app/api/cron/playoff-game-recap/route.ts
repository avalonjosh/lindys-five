import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';
import { quickFactCheck } from '@/lib/factCheck';
import { sendGameRecapNewsletter } from '@/lib/email';
import { TEAMS } from '@/lib/teamConfig';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const GAME_END_BUFFER_MS = 30 * 60 * 1000;

const PLAYOFF_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing an NHL playoff game recap for "Lindy's Five", a hockey analytics site.

Write an engaging narrative recap based ONLY on the verified box score data provided. 400-600 words in Markdown with ## headers and **bold** for names/stats.

Structure: Series context lead → result/score → key moments → standout performers → special teams → goaltending → what's next in the series.

ACCURACY RULES:
- Use ONLY data from the VERIFIED GAME DATA block. Every goal, assist, stat, and player name must appear in the data.
- Use the pre-calculated totals (TOTAL GOALS, Combined shots) instead of doing arithmetic yourself.
- Never invent quotes, atmosphere, or details not in the data.
- Emphasize the series implications — elimination scenarios, clinch scenarios, momentum shifts.`;

// Reverse lookup: NHL abbreviation -> our slug
const abbrevToSlug = Object.fromEntries(
  Object.entries(TEAMS).map(([slug, team]) => [team.abbreviation, slug])
);

async function fetchGameBoxScore(gameId: string) {
  try {
    const [boxscore, playByPlay, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`),
    ]);
    if (!boxscore?.homeTeam || !boxscore?.awayTeam) return null;
    return { boxscore, playByPlay, landing };
  } catch (error) {
    console.error(`Failed to fetch playoff box score for game ${gameId}:`, error);
    return null;
  }
}

function findPlayerName(playerId: number, homeStats: any, awayStats: any): string {
  const allPlayers = [
    ...(homeStats?.forwards || []), ...(homeStats?.defense || []), ...(homeStats?.goalies || []),
    ...(awayStats?.forwards || []), ...(awayStats?.defense || []), ...(awayStats?.goalies || []),
  ];
  const player = allPlayers.find((p: any) => p.playerId === playerId);
  return player?.name?.default || 'Unknown';
}

function formatPlayoffBoxScore(
  boxscore: any,
  playByPlay: any,
  landing: any,
  seriesInfo: { topSeedAbbrev: string; topSeedWins: number; bottomSeedWins: number; roundLabel: string }
): string {
  const homeTeam = boxscore.homeTeam;
  const awayTeam = boxscore.awayTeam;
  const homeStats = boxscore.playerByGameStats?.homeTeam;
  const awayStats = boxscore.playerByGameStats?.awayTeam;

  const gameDate = landing?.gameDate || boxscore.gameDate || 'Unknown Date';
  const formattedDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });

  const homeScore = homeTeam?.score || 0;
  const awayScore = awayTeam?.score || 0;
  const lastPeriodType = landing?.gameOutcome?.lastPeriodType || 'REG';
  const resultSuffix = lastPeriodType === 'OT' ? ' (OT)' : lastPeriodType === 'SO' ? ' (SO)' : '';

  let periodScores = '';
  (landing?.summary?.scoring || []).forEach((period: any, idx: number) => {
    const periodName = period.periodDescriptor?.periodType === 'OT' ? 'OT' : `Period ${idx + 1}`;
    periodScores += `${periodName}: ${homeTeam.abbrev} ${period.homeScore} - ${awayTeam.abbrev} ${period.awayScore}\n`;
  });

  let scoringSummary = '';
  (playByPlay?.plays || []).filter((p: any) => p.typeDescKey === 'goal').forEach((goal: any) => {
    const periodType = goal.periodDescriptor?.periodType || 'REG';
    const periodLabel = periodType === 'OT' ? 'OT' : `P${goal.periodDescriptor?.number || '?'}`;
    const time = goal.timeInPeriod || '??:??';
    const teamAbbrev = goal.details?.eventOwnerTeamId === homeTeam?.id ? homeTeam.abbrev : awayTeam.abbrev;
    const scorer = goal.details?.scoringPlayerId ? findPlayerName(goal.details.scoringPlayerId, homeStats, awayStats) : 'Unknown';
    const assists: string[] = [];
    if (goal.details?.assist1PlayerId) assists.push(findPlayerName(goal.details.assist1PlayerId, homeStats, awayStats));
    if (goal.details?.assist2PlayerId) assists.push(findPlayerName(goal.details.assist2PlayerId, homeStats, awayStats));
    const assistsText = assists.length > 0 ? `(${assists.join(', ')})` : '(unassisted)';
    let goalType = '';
    if (goal.details?.goalModifier === 'power-play') goalType = ' [PP]';
    else if (goal.details?.goalModifier === 'short-handed') goalType = ' [SH]';
    else if (goal.details?.goalModifier === 'empty-net') goalType = ' [EN]';
    else goalType = ' [EV]';
    scoringSummary += `- ${periodLabel} ${time}: ${teamAbbrev} - ${scorer} ${assistsText}${goalType}\n`;
  });

  let goalieStats = '';
  for (const { stats, abbrev } of [
    { stats: homeStats?.goalies || [], abbrev: homeTeam.abbrev },
    { stats: awayStats?.goalies || [], abbrev: awayTeam.abbrev },
  ]) {
    stats.forEach((g: any) => {
      const saves = g.saveShotsAgainst?.split('/')[0] || g.saves || 0;
      const shotsAgainst = g.saveShotsAgainst?.split('/')[1] || g.shotsAgainst || 0;
      const savePct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(1) : '0.0';
      goalieStats += `${abbrev}: ${g.name?.default || 'Unknown'} - ${saves} saves on ${shotsAgainst} shots (${savePct}% SV%)\n`;
    });
  }

  const ppStat = landing?.summary?.teamGameStats?.find((s: any) => s.category === 'powerPlay');
  let powerPlayStats = '';
  if (ppStat) {
    powerPlayStats = `- ${homeTeam.abbrev}: ${ppStat.homeValue}\n- ${awayTeam.abbrev}: ${ppStat.awayValue}`;
  }

  let threeStars = '';
  if (landing?.summary?.threeStars?.length > 0) {
    landing.summary.threeStars.forEach((star: any, idx: number) => {
      threeStars += `${idx + 1}. ${star.name?.default || 'Unknown'} (${star.teamAbbrev?.default || '?'})\n`;
    });
  }

  // Series context
  const seriesLine = `${seriesInfo.roundLabel} | Series: ${seriesInfo.topSeedAbbrev} leads ${seriesInfo.topSeedWins}-${seriesInfo.bottomSeedWins}`;

  return `
═══════════════════════════════════════════════════════
VERIFIED GAME DATA - ${formattedDate}
${homeTeam.name?.default || homeTeam.abbrev} vs ${awayTeam.name?.default || awayTeam.abbrev}
PLAYOFF GAME — ${seriesLine}
Source: Official NHL API Box Score
═══════════════════════════════════════════════════════

FINAL SCORE: ${homeTeam.abbrev} ${homeScore} - ${awayTeam.abbrev} ${awayScore}
TOTAL GOALS IN GAME: ${homeScore + awayScore} (${homeTeam.abbrev} ${homeScore} + ${awayTeam.abbrev} ${awayScore})
Result: ${resultSuffix ? resultSuffix.trim() : 'REG'}
Location: ${boxscore.venue?.default || 'Unknown'}

SERIES STATUS AFTER THIS GAME:
${seriesLine}

PERIOD BREAKDOWN:
${periodScores || 'Not available'}

SHOTS ON GOAL:
- ${homeTeam.abbrev}: ${homeTeam.sog || 0}
- ${awayTeam.abbrev}: ${awayTeam.sog || 0}
- Combined: ${(homeTeam.sog || 0) + (awayTeam.sog || 0)}

SCORING SUMMARY:
${scoringSummary || 'No goals scored'}

GOALTENDING:
${goalieStats || 'Not available'}

POWER PLAY:
${powerPlayStats || 'Not available'}

${threeStars ? `THREE STARS:\n${threeStars}` : ''}

═══════════════════════════════════════════════════════
`;
}

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
    gameId: postData.gameId, opponent: postData.opponent, gameDate: postData.gameDate,
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

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Stanley Cup Final',
};

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch bracket to find completed playoff games
    const bracketRes = await fetchJsonWithRetry(`${NHL_API_BASE}/playoff-bracket/20252026`);
    if (!bracketRes?.rounds || bracketRes.rounds.length === 0) {
      return NextResponse.json({ success: true, message: 'No playoff bracket data available', gamesProcessed: 0 });
    }

    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const results: any[] = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('playoff-game-recap');

    for (const round of bracketRes.rounds) {
      for (const series of round.series || []) {
        const topTeam = series.matchupTeams?.find((t: any) => t.seed?.isTop);
        const bottomTeam = series.matchupTeams?.find((t: any) => !t.seed?.isTop);
        if (!topTeam || !bottomTeam) continue;

        for (const game of series.games || []) {
          if (game.gameState !== 'FINAL' && game.gameState !== 'OFF') continue;
          if (new Date(game.gameDate) < cutoff) continue;

          const gameId = String(game.id);

          // Check if already processed
          const processed = await kv.sismember('blog:playoff-gamerecap:processed', gameId);
          if (processed) continue;

          // Buffer: wait 30min after estimated end
          const gameStart = new Date(game.startTimeUTC || game.gameDate);
          const estimatedEnd = new Date(gameStart.getTime() + 3 * 60 * 60 * 1000);
          if (now.getTime() - estimatedEnd.getTime() < GAME_END_BUFFER_MS) continue;

          try {
            const boxData = await fetchGameBoxScore(gameId);
            if (!boxData) {
              results.push({ gameId, error: 'Failed to fetch box score' });
              continue;
            }

            const homeAbbrev = boxData.boxscore.homeTeam.abbrev;
            const awayAbbrev = boxData.boxscore.awayTeam.abbrev;
            const homeScore = boxData.boxscore.homeTeam.score || 0;
            const awayScore = boxData.boxscore.awayTeam.score || 0;
            const homeName = boxData.boxscore.homeTeam.name?.default || homeAbbrev;
            const awayName = boxData.boxscore.awayTeam.name?.default || awayAbbrev;
            const periodType = boxData.landing?.gameOutcome?.lastPeriodType || 'REG';

            const seriesInfo = {
              topSeedAbbrev: topTeam.team.abbrev,
              topSeedWins: series.topSeedWins || 0,
              bottomSeedWins: series.bottomSeedWins || 0,
              roundLabel: ROUND_LABELS[round.roundNumber] || `Round ${round.roundNumber}`,
            };

            const verifiedGameData = formatPlayoffBoxScore(boxData.boxscore, boxData.playByPlay, boxData.landing, seriesInfo);

            const message = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: [{ type: 'text' as const, text: PLAYOFF_RECAP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } }],
              messages: [{ role: 'user', content: `Write a playoff game recap based on the following verified box score data:\n\n${verifiedGameData}\n\nThe article should be 400-600 words.` }],
            });

            const content = message.content.filter((b: any) => b.type === 'text').map((b: any) => b.text).join('\n');
            const factCheck = await quickFactCheck(anthropic, content, verifiedGameData);
            const shouldPublish = autoPublish && factCheck.passed;

            const winner = homeScore > awayScore ? homeName : awayName;
            const loser = homeScore > awayScore ? awayName : homeName;
            const winScore = Math.max(homeScore, awayScore);
            const loseScore = Math.min(homeScore, awayScore);
            const otSuffix = periodType === 'OT' ? ' in OT' : periodType === 'SO' ? ' in SO' : '';
            const title = `${winner} Beat ${loser} ${winScore}-${loseScore}${otSuffix} — ${seriesInfo.roundLabel}`;

            const metaDescription = `${seriesInfo.roundLabel} recap: ${winner} defeat ${loser} ${winScore}-${loseScore}${otSuffix}. Series: ${seriesInfo.topSeedWins}-${seriesInfo.bottomSeedWins}.`;

            // Determine which team slug to use — pick the one with more subscribers or home team
            const homeSlug = abbrevToSlug[homeAbbrev] || '';
            const awaySlug = abbrevToSlug[awayAbbrev] || '';
            const teamSlug = homeSlug || awaySlug || 'sabres';

            const post = await createPost({
              title, content, team: teamSlug, type: 'playoff-game-recap',
              status: shouldPublish ? 'published' : 'draft',
              gameId: game.id, opponent: homeAbbrev === teamSlug ? awayAbbrev : homeAbbrev,
              gameDate: game.gameDate, metaDescription, aiModel: 'claude-sonnet-4-20250514',
            });

            await kv.sadd('blog:playoff-gamerecap:processed', gameId);
            await kv.set(`blog:playoff-gamerecap:log:${gameId}`, {
              processedAt: new Date().toISOString(), postId: post.id,
              matchup: `${homeAbbrev} vs ${awayAbbrev}`, result: `${homeScore}-${awayScore}`,
            });

            if (post.status === 'published') {
              try {
                await sendGameRecapNewsletter(post);
              } catch (emailError) {
                console.error(`Failed to send playoff recap newsletter for game ${gameId}:`, emailError);
              }
            }

            results.push({ gameId, postId: post.id, title: post.title, status: post.status });
          } catch (error: any) {
            console.error(`Error processing playoff game ${gameId}:`, error);
            results.push({ gameId, error: error.message });
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      gamesProcessed: results.filter(r => !r.error).length,
      results,
    });
  } catch (error: any) {
    console.error('Playoff game recap cron error:', error);
    return NextResponse.json({ error: 'Failed to process playoff game recaps', message: error.message }, { status: 500 });
  }
}
