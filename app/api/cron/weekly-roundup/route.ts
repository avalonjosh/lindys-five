import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';
import { generateAndUploadOgImage } from '@/lib/utils/ogImage';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

const WEEKLY_ROUNDUP_SYSTEM_PROMPT = `You are a professional sports journalist writing the weekly roundup for "Lindy's Five", a Buffalo Sabres fan blog.

Write a 600-900 word week-in-review in Markdown with ## headers and **bold** for names/stats. Do NOT include "TITLE:" or "META:" prefixes.

Sections: Week overview → game-by-game highlights → star performers → standings update → looking ahead.

ACCURACY: Use ONLY the VERIFIED WEEKLY DATA provided. Never invent stats or use external information. Use pre-calculated totals instead of doing arithmetic.`;

// Fetch game box score data with retry logic
async function fetchGameBoxScore(gameId: string) {
  try {
    const [boxscore, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);

    if (!boxscore?.homeTeam || !boxscore?.awayTeam) {
      console.error(`Incomplete box score data for game ${gameId}`);
      return null;
    }

    return { boxscore, landing };
  } catch (error) {
    console.error(`Failed to fetch box score for game ${gameId} after retries:`, error);
    return null;
  }
}

// Fetch current standings with retry logic
async function fetchStandings() {
  try {
    const today = new Date().toISOString().split('T')[0];
    const data = await fetchJsonWithRetry(`${NHL_API_BASE}/standings/${today}`);

    const sabres = data.standings?.find((t: any) => t.teamAbbrev?.default === 'BUF');
    if (!sabres) return null;

    return {
      wins: sabres.wins,
      losses: sabres.losses,
      otLosses: sabres.otLosses,
      points: sabres.points,
      divisionRank: sabres.divisionSequence,
      conferenceRank: sabres.conferenceSequence,
      leagueRank: sabres.leagueSequence,
      gamesPlayed: sabres.gamesPlayed,
      streakCode: sabres.streakCode,
      streakCount: sabres.streakCount,
      l10Wins: sabres.l10Wins,
      l10Losses: sabres.l10Losses,
      l10OtLosses: sabres.l10OtLosses
    };
  } catch (error) {
    console.error('Failed to fetch standings after retries:', error);
    return null;
  }
}

function getLastMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getLastSunday(date: Date) {
  const monday = getLastMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

function formatDate(date: Date) {
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _findPlayerName(playerId: number, homeStats: any, awayStats: any) {
  const allPlayers = [
    ...(homeStats?.forwards || []),
    ...(homeStats?.defense || []),
    ...(homeStats?.goalies || []),
    ...(awayStats?.forwards || []),
    ...(awayStats?.defense || []),
    ...(awayStats?.goalies || [])
  ];
  const player = allPlayers.find((p: any) => p.playerId === playerId);
  return player?.name?.default || 'Unknown';
}

function extractGameHighlights(boxData: any, isHome: boolean) {
  if (!boxData) return { topScorers: 'N/A', goalie: 'N/A' };

  const { boxscore } = boxData;
  const sabresStats = isHome
    ? boxscore.playerByGameStats?.homeTeam
    : boxscore.playerByGameStats?.awayTeam;

  const skaters = [...(sabresStats?.forwards || []), ...(sabresStats?.defense || [])];
  const pointGetters = skaters
    .filter((p: any) => (p.goals || 0) + (p.assists || 0) > 0)
    .sort((a: any, b: any) => ((b.goals || 0) + (b.assists || 0)) - ((a.goals || 0) + (a.assists || 0)))
    .slice(0, 3)
    .map((p: any) => `${p.name?.default} (${p.goals}G, ${p.assists}A)`)
    .join(', ');

  const goalies = sabresStats?.goalies || [];
  const starter = goalies.find((g: any) => g.toi && g.toi !== '00:00') || goalies[0];
  const goalieText = starter
    ? `${starter.name?.default} (${starter.saveShotsAgainst || '0/0'}, ${starter.savePctg ? (starter.savePctg * 100).toFixed(1) + '%' : 'N/A'})`
    : 'N/A';

  return { topScorers: pointGetters || 'No scorers', goalie: goalieText };
}

function formatWeeklyContext(weekStart: Date, weekEnd: Date, games: any[], boxScores: any[], standings: any, upcomingGames: any[]) {
  let wins = 0, otLosses = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  const gameSummaries: any[] = [];

  games.forEach((game: any, i: number) => {
    const isHome = game.homeTeam?.abbrev === 'BUF';
    const sabresScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
    const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
    const opponent = isHome ? game.awayTeam : game.homeTeam;
    const periodType = game.gameOutcome?.lastPeriodType || 'REG';

    if (sabresScore > oppScore) wins++;
    else if (periodType === 'OT' || periodType === 'SO') otLosses++;
    else losses++;

    goalsFor += sabresScore || 0;
    goalsAgainst += oppScore || 0;

    const result = sabresScore > oppScore ? 'W' : 'L';
    const otLabel = periodType !== 'REG' ? ` (${periodType})` : '';
    const { topScorers, goalie } = extractGameHighlights(boxScores[i], isHome);

    gameSummaries.push({
      date: game.gameDate, opponent: opponent?.abbrev || 'UNK',
      location: isHome ? 'Home' : 'Away', score: `${sabresScore}-${oppScore}`,
      result: `${result}${otLabel}`, topScorers, goalie
    });
  });

  const weekPoints = wins * 2 + otLosses;

  const upcomingText = upcomingGames.length > 0
    ? upcomingGames.map((g: any) => {
        const isHome = g.homeTeam?.abbrev === 'BUF';
        const opp = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
        return `${g.gameDate}: ${isHome ? 'vs' : '@'} ${opp}`;
      }).join('\n')
    : 'No games scheduled';

  return `
═══════════════════════════════════════════════════════
VERIFIED WEEKLY DATA
Week of ${formatDate(weekStart)} - ${formatDate(weekEnd)}
Source: Official NHL API
═══════════════════════════════════════════════════════

WEEK RECORD: ${wins}-${losses}-${otLosses} (${weekPoints} points earned)
GOALS: ${goalsFor} for, ${goalsAgainst} against (${goalsFor > goalsAgainst ? '+' : ''}${goalsFor - goalsAgainst} differential)

GAMES THIS WEEK:
${gameSummaries.map((g: any) => `
${g.date} (${g.location}): ${g.result} ${g.score} vs ${g.opponent}
  Top Scorers: ${g.topScorers}
  Goalie: ${g.goalie}
`).join('')}

CURRENT STANDINGS (after this week):
- Record: ${standings?.wins || 0}-${standings?.losses || 0}-${standings?.otLosses || 0} (${standings?.points || 0} points)
- Division Rank: ${standings?.divisionRank || 'N/A'}
- Conference Rank: ${standings?.conferenceRank || 'N/A'}
- Last 10: ${standings?.l10Wins || 0}-${standings?.l10Losses || 0}-${standings?.l10OtLosses || 0}
- Streak: ${standings?.streakCode || 'N/A'}${standings?.streakCount || ''}

UPCOMING SCHEDULE:
${upcomingText}

═══════════════════════════════════════════════════════
`;
}

function generateWeeklyTitle(weekStart: Date, wins: number, losses: number, otLosses: number) {
  const formattedDate = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const points = wins * 2 + otLosses;
  const totalGames = wins + losses + otLosses;

  if (totalGames === 0) return `Sabres Week in Review: ${formattedDate}`;
  if (wins >= 3 && losses === 0) return `Sabres Dominate: ${wins}-${losses}-${otLosses} Week`;
  if (wins === 0 && totalGames >= 2) return `Sabres Struggle: ${wins}-${losses}-${otLosses} Week`;
  if (points >= 4 && totalGames >= 3) return `Solid Week for the Sabres: ${wins}-${losses}-${otLosses}`;

  return `Sabres Week in Review: ${wins}-${losses}-${otLosses}`;
}

async function createPost(postData: any) {
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = postData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const slug = `${titleSlug}-${dateStr}`;

  const plainText = postData.content.replace(/#{1,6}\s/g, '').replace(/\*\*|__/g, '').replace(/\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const post = {
    id, slug, title: postData.title, content: postData.content, excerpt,
    team: postData.team, type: postData.type, status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    weekStartDate: postData.weekStartDate, weekEndDate: postData.weekEndDate,
    aiGenerated: true, aiModel: 'claude-sonnet-4-20250514', metaDescription: postData.metaDescription,
    ...(postData.ogImage && { ogImage: postData.ogImage })
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
  // Verify cron secret (Vercel sends this in authorization header)
  const authHeader = request.headers.get('authorization');
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const now = new Date();
    const weekStart = getLastMonday(now);
    const weekEnd = getLastSunday(now);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    const lastRoundupDate = await kv.get('blog:weekly:last');
    if (lastRoundupDate === weekStartStr) {
      return NextResponse.json({
        success: false, message: 'Weekly roundup already generated for this week', weekStart: weekStartStr
      });
    }

    const scheduleRes = await fetch(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const schedule = await scheduleRes.json();

    const weekGames = (schedule.games || [])
      .filter((g: any) => g.gameType === 2)
      .filter((g: any) => {
        const gameDate = new Date(g.gameDate);
        return gameDate >= weekStart && gameDate <= weekEnd;
      })
      .filter((g: any) => g.gameState === 'FINAL' || g.gameState === 'OFF');

    if (weekGames.length === 0) {
      return NextResponse.json({
        success: false, message: 'No completed games found for this week', weekStart: weekStartStr
      });
    }

    const boxScores = await Promise.all(weekGames.map((g: any) => fetchGameBoxScore(g.id)));
    const standings = await fetchStandings();

    const upcomingGames = (schedule.games || [])
      .filter((g: any) => g.gameType === 2)
      .filter((g: any) => g.gameState === 'FUT')
      .slice(0, 5);

    const context = formatWeeklyContext(weekStart, weekEnd, weekGames, boxScores, standings, upcomingGames);

    let weekWins = 0, weekLosses = 0, weekOtLosses = 0;
    weekGames.forEach((game: any) => {
      const isHome = game.homeTeam?.abbrev === 'BUF';
      const sabresScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
      const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
      const periodType = game.gameOutcome?.lastPeriodType || 'REG';

      if (sabresScore > oppScore) weekWins++;
      else if (periodType === 'OT' || periodType === 'SO') weekOtLosses++;
      else weekLosses++;
    });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: [{ type: 'text' as const, text: WEEKLY_ROUNDUP_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' as const } }],
      messages: [{ role: 'user', content: `Write the weekly roundup article based on this data:\n\n${context}` }]
    });

    const content = message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');

    const title = generateWeeklyTitle(weekStart, weekWins, weekLosses, weekOtLosses);
    const metaDescription = `Buffalo Sabres week in review: ${weekWins}-${weekLosses}-${weekOtLosses} from ${formatDate(weekStart)} to ${formatDate(weekEnd)}. Game recaps, standout performers, and standings update.`;

    const autoPublish = await getAutoPublishSetting('weekly');

    // Generate OG image
    const weekRecord = `${weekWins}-${weekLosses}-${weekOtLosses}`;
    let ogImage: string | undefined;
    try {
      const weekStartStr2 = weekStart.toISOString().split('T')[0];
      const weekEndStr2 = weekEnd.toISOString().split('T')[0];
      ogImage = await generateAndUploadOgImage({
        type: 'weekly-roundup',
        teamAbbrev: 'BUF',
        weekRecord,
        weekStart: weekStartStr2,
        weekEnd: weekEndStr2,
      }, `weekly-roundup-${weekStartStr2}`);
    } catch (imgError) {
      console.error('Failed to generate OG image for weekly roundup:', imgError);
    }

    const post = await createPost({
      title, content, team: 'sabres', type: 'weekly-roundup',
      status: autoPublish ? 'published' : 'draft',
      weekStartDate: weekStart.toISOString(), weekEndDate: weekEnd.toISOString(), metaDescription, ogImage
    });

    await kv.set('blog:weekly:last', weekStartStr);

    return NextResponse.json({
      success: true, postId: post.id, postSlug: post.slug, status: post.status,
      weekStart: weekStartStr, gamesProcessed: weekGames.length
    });

  } catch (error: any) {
    console.error('Weekly roundup generation error:', error);
    return NextResponse.json({ error: 'Failed to generate weekly roundup', message: error.message }, { status: 500 });
  }
}
