import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

const SET_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing a set recap for "Lindy's Five", a Buffalo Sabres fan blog focused on tracking the season in 5-game chunks called "sets."

Your task is to write an engaging, analytical set recap based ONLY on the verified data provided. Do NOT use web search - all the facts you need are in the data.

Context about "Lindy's Five":
- The blog tracks the Sabres season in 5-game "sets" (16-17 sets per season)
- Each set is evaluated based on points earned out of a maximum 10
- 6+ points in a set is considered a success (playoff pace)
- 5 points is break-even
- 0-4 points indicates struggles

Writing style:
- Professional sports journalism tone - analytical yet accessible
- Focus on the set as a whole, not just individual games
- Identify patterns, trends, and storylines across the 5 games
- Be honest about struggles while remaining constructive

Structure:
- Opening: Set result, points earned, key takeaway
- Set narrative: How did the 5 games unfold?
- What worked: Strengths and positive trends
- Areas of concern: Issues that need addressing
- Closing: What this set means for the season trajectory

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for player names and key stats
- Article should be 600-900 words

CRITICAL: Use ONLY the data provided in the VERIFIED SET DATA block.`;

async function fetchGameBoxScore(gameId: string) {
  try {
    const [boxscore, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);
    if (!boxscore?.homeTeam || !boxscore?.awayTeam) return null;
    return { boxscore, landing };
  } catch (error) { console.error(`Failed to fetch box score for game ${gameId}:`, error); return null; }
}

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatSetData(setNumber: number, games: any[], boxScores: any[]) {
  const startDate = games[0].gameDate;
  const endDate = games[games.length - 1].gameDate;
  const dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  let totalWins = 0, totalOTL = 0, totalLosses = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let totalGoalsFor = 0, totalGoalsAgainst = 0, _totalShotsFor = 0, _totalShotsAgainst = 0;

  const gamesSummary: any[] = [];
  boxScores.forEach((boxData: any, index: number) => {
    if (!boxData) return;
    const game = games[index];
    const { boxscore, landing } = boxData;
    const isHome = boxscore.homeTeam?.abbrev === 'BUF';
    const sabresTeam = isHome ? boxscore.homeTeam : boxscore.awayTeam;
    const oppTeam = isHome ? boxscore.awayTeam : boxscore.homeTeam;
    const sabresScore = sabresTeam?.score || 0;
    const oppScore = oppTeam?.score || 0;
    const lastPeriodType = landing?.gameOutcome?.lastPeriodType || 'REG';

    let outcome;
    if (sabresScore > oppScore) { outcome = 'W'; totalWins++; }
    else if (lastPeriodType === 'OT' || lastPeriodType === 'SO') { outcome = 'OTL'; totalOTL++; }
    else { outcome = 'L'; totalLosses++; }

    totalGoalsFor += sabresScore; totalGoalsAgainst += oppScore;
    _totalShotsFor += sabresTeam?.sog || 0; _totalShotsAgainst += oppTeam?.sog || 0;

    gamesSummary.push({
      gameNum: index + 1, date: formatDate(game.gameDate),
      opponent: oppTeam?.name?.default || oppTeam?.abbrev, oppAbbrev: oppTeam?.abbrev,
      location: isHome ? 'Home' : 'Away', result: `${outcome}${lastPeriodType !== 'REG' ? ` (${lastPeriodType})` : ''}`,
      score: `${sabresScore}-${oppScore}`, sabresShots: sabresTeam?.sog || 0, oppShots: oppTeam?.sog || 0,
    });
  });

  const totalPoints = totalWins * 2 + totalOTL;
  const gamesPlayed = boxScores.filter((b: any) => b !== null).length;
  const maxPoints = gamesPlayed * 2;

  let gameByGameText = '';
  gamesSummary.forEach((g: any) => {
    gameByGameText += `Game ${g.gameNum} (${g.date}): ${g.result} ${g.score} ${g.location === 'Home' ? 'vs' : '@'} ${g.oppAbbrev}\n  - Location: ${g.location}\n  - Shots: Sabres ${g.sabresShots} - ${g.oppAbbrev} ${g.oppShots}\n`;
  });

  const opponents = gamesSummary.map((g: any) => g.opponent).join(', ');
  const goalsForPerGame = gamesPlayed > 0 ? (totalGoalsFor / gamesPlayed).toFixed(2) : '0.00';
  const goalsAgainstPerGame = gamesPlayed > 0 ? (totalGoalsAgainst / gamesPlayed).toFixed(2) : '0.00';
  const goalDiff = totalGoalsFor - totalGoalsAgainst;

  return {
    context: `
═══════════════════════════════════════════════════════
VERIFIED SET DATA - Set #${setNumber}
Buffalo Sabres | ${dateRange} | 2025-26 Season
═══════════════════════════════════════════════════════

SET OVERVIEW:
- Set Number: ${setNumber} of 17
- Date Range: ${dateRange}
- Record: ${totalWins}-${totalLosses}-${totalOTL} (${totalPoints} of ${maxPoints} points)
- Opponents: ${opponents}

SET STATISTICS:
- Goals For: ${totalGoalsFor} (${goalsForPerGame} per game)
- Goals Against: ${totalGoalsAgainst} (${goalsAgainstPerGame} per game)
- Goal Differential: ${goalDiff > 0 ? '+' : ''}${goalDiff}

GAME-BY-GAME BREAKDOWN:
${gameByGameText}
═══════════════════════════════════════════════════════
`,
    stats: { wins: totalWins, losses: totalLosses, otLosses: totalOTL, points: totalPoints, maxPoints, goalsFor: totalGoalsFor, goalsAgainst: totalGoalsAgainst, startDate, endDate },
    opponents
  };
}

function generateSetTitle(setNumber: number, wins: number, losses: number, otLosses: number, points: number) {
  const record = `${wins}-${losses}-${otLosses}`;
  if (points >= 8) return `Sabres Excel in Set ${setNumber}: ${record} (${points} Points)`;
  if (points >= 6) return `Sabres Post Solid Set ${setNumber}: ${record} (${points} Points)`;
  if (points === 5) return `Sabres Split Set ${setNumber}: ${record} (${points} Points)`;
  if (points >= 3) return `Sabres Struggle in Set ${setNumber}: ${record} (${points} Points)`;
  return `Sabres Stumble Through Set ${setNumber}: ${record} (${points} Points)`;
}

async function generateUniqueSlug(title: string, date: string) {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;
  if (!(await kv.get(`blog:slug:${baseSlug}`))) return baseSlug;
  for (let i = 2; i <= 11; i++) { const s = `${baseSlug}-${i}`; if (!(await kv.get(`blog:slug:${s}`))) return s; }
  return `${baseSlug}-${Date.now()}`;
}

async function createPost(postData: any) {
  const now = new Date().toISOString();
  const slug = await generateUniqueSlug(postData.title, now);
  const plainText = postData.content.replace(/#{1,6}\s/g, '').replace(/\*\*|__/g, '').replace(/\*|_/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ').trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');
  const id = crypto.randomUUID();

  const post = {
    id, slug, title: postData.title, content: postData.content, excerpt,
    team: postData.team, type: postData.type, status: postData.status,
    createdAt: now, publishedAt: postData.status === 'published' ? now : null, updatedAt: now,
    setNumber: postData.setNumber, setStartDate: postData.setStartDate, setEndDate: postData.setEndDate,
    opponent: postData.opponent, aiGenerated: true, aiModel: postData.aiModel, metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd(`blog:posts:${post.team}`, { score, member: id });
  await kv.zadd(`blog:posts:type:${post.type}`, { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);
  return post;
}

async function hasSetBeenProcessed(setNumber: number) { return await kv.sismember('blog:setrecap:processed', String(setNumber)); }
async function markSetProcessed(setNumber: number, postId: string, metadata: any) {
  await kv.sadd('blog:setrecap:processed', String(setNumber));
  await kv.set(`blog:setrecap:log:${setNumber}`, { processedAt: new Date().toISOString(), postId, ...metadata });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Optional parameters from query (for manual triggers via POST body, use searchParams for GET)
  const requestedSetNumber = request.nextUrl.searchParams.get('setNumber');
  const forceRegenerate = request.nextUrl.searchParams.get('force') === 'true';

  try {
    const schedule = await fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const completedGames = (schedule.games || []).filter((g: any) => g.gameType === 2).filter((g: any) => g.gameState === 'FINAL' || g.gameState === 'OFF');
    const totalGames = completedGames.length;
    const completedSetCount = Math.floor(totalGames / 5);

    if (completedSetCount === 0) {
      return NextResponse.json({ success: true, message: 'No completed sets yet', totalGames, completedSets: 0 });
    }

    let targetSetNumber: number;
    if (requestedSetNumber !== null) {
      const setNum = parseInt(requestedSetNumber, 10);
      if (isNaN(setNum) || setNum < 1 || setNum > completedSetCount) {
        return NextResponse.json({ error: `Invalid set number. Must be between 1 and ${completedSetCount}`, completedSets: completedSetCount }, { status: 400 });
      }
      targetSetNumber = setNum;
    } else {
      targetSetNumber = completedSetCount;
    }

    if ((await hasSetBeenProcessed(targetSetNumber)) && !forceRegenerate) {
      return NextResponse.json({ success: true, message: `Set ${targetSetNumber} already processed`, totalGames, completedSets: completedSetCount, hint: 'Use force=true to regenerate' });
    }

    const setGames = completedGames.slice((targetSetNumber - 1) * 5, targetSetNumber * 5);
    if (setGames.length < 5) {
      return NextResponse.json({ success: true, message: `Set ${targetSetNumber} not complete yet`, gamesInSet: setGames.length });
    }

    const boxScores = await Promise.all(setGames.map((game: any) => fetchGameBoxScore(game.id)));
    if (boxScores.filter((b: any) => b !== null).length < 5) {
      return NextResponse.json({ error: 'Failed to fetch all box scores', fetched: boxScores.filter((b: any) => b !== null).length }, { status: 500 });
    }

    const { context: verifiedSetData, stats, opponents } = formatSetData(targetSetNumber, setGames, boxScores);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('set-recap');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514', max_tokens: 4096, system: SET_RECAP_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: `Write a set recap for the Buffalo Sabres' Set #${targetSetNumber} of the 2025-26 season:\n\n${verifiedSetData}\n\nThe article should be 600-900 words.` }]
    });

    const content = message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
    const title = generateSetTitle(targetSetNumber, stats.wins, stats.losses, stats.otLosses, stats.points);
    const metaDescription = `Buffalo Sabres Set ${targetSetNumber} recap: ${stats.wins}-${stats.losses}-${stats.otLosses} (${stats.points} points) from ${formatDate(stats.startDate)} to ${formatDate(stats.endDate)}.`;

    const post = await createPost({
      title, content, team: 'sabres', type: 'set-recap',
      status: autoPublish ? 'published' : 'draft',
      setNumber: targetSetNumber, setStartDate: stats.startDate, setEndDate: stats.endDate,
      opponent: opponents, metaDescription, aiModel: 'claude-sonnet-4-20250514'
    });

    await markSetProcessed(targetSetNumber, post.id, { record: `${stats.wins}-${stats.losses}-${stats.otLosses}`, points: stats.points, startDate: stats.startDate, endDate: stats.endDate });

    return NextResponse.json({
      success: true, setNumber: targetSetNumber, postId: post.id, postSlug: post.slug,
      status: post.status, title: post.title, record: `${stats.wins}-${stats.losses}-${stats.otLosses}`, points: stats.points
    });
  } catch (error: any) {
    console.error('Set recap cron error:', error);
    return NextResponse.json({ error: 'Failed to process set recap', message: error.message }, { status: 500 });
  }
}
