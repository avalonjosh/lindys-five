import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const GAME_END_BUFFER_MS = 30 * 60 * 1000; // 30 minutes

const GAME_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing a game recap for "Lindy's Five", a Buffalo Sabres fan blog.

Your task is to write an engaging, narrative game recap based ONLY on the verified box score data provided. Do NOT use web search - all the facts you need are in the data.

Writing style:
- Professional sports journalism tone - authoritative yet accessible
- Lead with the outcome and final score
- Highlight key moments: big goals, saves, momentum swings
- Feature standout individual performances using the stats provided
- Build a narrative arc: how did the game unfold period by period?
- End with forward-looking perspective or context

Structure:
- Opening paragraph: Result, score, key takeaway
- Game flow: Period-by-period narrative with specific plays
- Standout performances: Players who made a difference
- Special teams: Power play and penalty kill impact
- Goaltending: How the netminders performed
- Closing: What this means going forward

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for player names and key stats
- Keep paragraphs concise (3-4 sentences max)
- Article should be 400-600 words

CRITICAL: Use ONLY the data provided in the VERIFIED GAME DATA block. Do not invent any statistics, player names, or game details not explicitly listed.`;

async function fetchGameBoxScore(gameId: string) {
  try {
    const [boxscore, playByPlay, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);
    if (!boxscore?.homeTeam || !boxscore?.awayTeam) { console.error(`Incomplete box score data for game ${gameId}`); return null; }
    return { boxscore, playByPlay, landing };
  } catch (error) { console.error(`Failed to fetch box score for game ${gameId} after retries:`, error); return null; }
}

function findPlayerName(playerId: number, sabresStats: any, opponentStats: any): string {
  const allPlayers = [...(sabresStats?.forwards || []), ...(sabresStats?.defense || []), ...(sabresStats?.goalies || []), ...(opponentStats?.forwards || []), ...(opponentStats?.defense || []), ...(opponentStats?.goalies || [])];
  const player = allPlayers.find((p: any) => p.playerId === playerId);
  return player?.name?.default || 'Unknown';
}

function formatBoxScore(boxscore: any, playByPlay: any, landing: any): string {
  const isHomeTeamSabres = boxscore.homeTeam?.abbrev === 'BUF';
  const sabresTeam = isHomeTeamSabres ? boxscore.homeTeam : boxscore.awayTeam;
  const opponentTeam = isHomeTeamSabres ? boxscore.awayTeam : boxscore.homeTeam;
  const sabresPlayerStats = isHomeTeamSabres ? boxscore.playerByGameStats?.homeTeam : boxscore.playerByGameStats?.awayTeam;
  const opponentPlayerStats = isHomeTeamSabres ? boxscore.playerByGameStats?.awayTeam : boxscore.playerByGameStats?.homeTeam;

  const gameDate = landing?.gameDate || boxscore.gameDate || 'Unknown Date';
  const formattedDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });

  const sabresScore = sabresTeam?.score || 0;
  const opponentScore = opponentTeam?.score || 0;
  const result = sabresScore > opponentScore ? 'WIN' : 'LOSS';
  const lastPeriodType = landing?.gameOutcome?.lastPeriodType || 'REG';
  const resultSuffix = lastPeriodType === 'OT' ? ' (OT)' : lastPeriodType === 'SO' ? ' (SO)' : '';

  let periodScores = '';
  (landing?.summary?.scoring || []).forEach((period: any, idx: number) => {
    const sabresGoals = isHomeTeamSabres ? period.homeScore : period.awayScore;
    const oppGoals = isHomeTeamSabres ? period.awayScore : period.homeScore;
    const periodName = period.periodDescriptor?.periodType === 'OT' ? 'OT' : `Period ${idx + 1}`;
    periodScores += `${periodName}: Sabres ${sabresGoals} - ${opponentTeam?.abbrev} ${oppGoals}\n`;
  });

  let scoringSummary = '';
  (playByPlay?.plays || []).filter((p: any) => p.typeDescKey === 'goal').forEach((goal: any) => {
    const period = goal.periodDescriptor?.number || '?';
    const periodType = goal.periodDescriptor?.periodType || 'REG';
    const periodLabel = periodType === 'OT' ? 'OT' : `P${period}`;
    const time = goal.timeInPeriod || '??:??';
    const teamAbbrev = goal.details?.eventOwnerTeamId === sabresTeam?.id ? 'BUF' : opponentTeam?.abbrev;
    const scorer = goal.details?.scoringPlayerId ? findPlayerName(goal.details.scoringPlayerId, sabresPlayerStats, opponentPlayerStats) : 'Unknown';
    const assists: string[] = [];
    if (goal.details?.assist1PlayerId) assists.push(findPlayerName(goal.details.assist1PlayerId, sabresPlayerStats, opponentPlayerStats));
    if (goal.details?.assist2PlayerId) assists.push(findPlayerName(goal.details.assist2PlayerId, sabresPlayerStats, opponentPlayerStats));
    const assistsText = assists.length > 0 ? `(${assists.join(', ')})` : '(unassisted)';
    let goalType = '';
    if (goal.details?.goalModifier === 'power-play') goalType = ' [PP]';
    else if (goal.details?.goalModifier === 'short-handed') goalType = ' [SH]';
    else if (goal.details?.goalModifier === 'empty-net') goalType = ' [EN]';
    else goalType = ' [EV]';
    scoringSummary += `- ${periodLabel} ${time}: ${teamAbbrev} - ${scorer} ${assistsText}${goalType}\n`;
  });

  let goalieStats = '';
  (sabresPlayerStats?.goalies || []).forEach((g: any) => {
    const saves = g.saveShotsAgainst?.split('/')[0] || g.saves || 0;
    const shotsAgainst = g.saveShotsAgainst?.split('/')[1] || g.shotsAgainst || 0;
    const savePct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(1) : '0.0';
    goalieStats += `Sabres: ${g.name?.default || 'Unknown'} - ${saves} saves on ${shotsAgainst} shots (${savePct}% SV%)\n`;
  });
  (opponentPlayerStats?.goalies || []).forEach((g: any) => {
    const saves = g.saveShotsAgainst?.split('/')[0] || g.saves || 0;
    const shotsAgainst = g.saveShotsAgainst?.split('/')[1] || g.shotsAgainst || 0;
    const savePct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(1) : '0.0';
    goalieStats += `${opponentTeam?.abbrev}: ${g.name?.default || 'Unknown'} - ${saves} saves on ${shotsAgainst} shots (${savePct}% SV%)\n`;
  });

  const sabresPP = landing?.summary?.teamGameStats?.find((s: any) => s.category === 'powerPlay');
  let powerPlayStats = '';
  if (sabresPP) {
    powerPlayStats = `- Sabres: ${isHomeTeamSabres ? sabresPP.homeValue : sabresPP.awayValue}\n- ${opponentTeam?.abbrev}: ${isHomeTeamSabres ? sabresPP.awayValue : sabresPP.homeValue}`;
  }

  let penaltySummary = '';
  (playByPlay?.plays || []).filter((p: any) => p.typeDescKey === 'penalty').slice(0, 10).forEach((pen: any) => {
    const periodLabel = (pen.periodDescriptor?.periodType || 'REG') === 'OT' ? 'OT' : `P${pen.periodDescriptor?.number || '?'}`;
    const teamAbbrev = pen.details?.eventOwnerTeamId === sabresTeam?.id ? 'BUF' : opponentTeam?.abbrev;
    const player = pen.details?.committedByPlayerId ? findPlayerName(pen.details.committedByPlayerId, sabresPlayerStats, opponentPlayerStats) : 'Unknown';
    penaltySummary += `- ${periodLabel} ${pen.timeInPeriod || '??:??'}: ${teamAbbrev} ${player} - ${pen.details?.descKey || 'penalty'} (${pen.details?.duration || 2} min)\n`;
  });

  let threeStars = '';
  if (landing?.summary?.threeStars?.length > 0) {
    landing.summary.threeStars.forEach((star: any, idx: number) => { threeStars += `${idx + 1}. ${star.name?.default || 'Unknown'} (${star.teamAbbrev?.default || '?'})\n`; });
  }

  return `
═══════════════════════════════════════════════════════
VERIFIED GAME DATA - ${formattedDate}
Buffalo Sabres vs ${opponentTeam?.name?.default || opponentTeam?.abbrev}
Source: Official NHL API Box Score
═══════════════════════════════════════════════════════

FINAL SCORE: Sabres ${sabresScore} - ${opponentTeam?.abbrev} ${opponentScore}
Result: ${result}${resultSuffix}
Location: ${isHomeTeamSabres ? 'Home' : 'Away'}

PERIOD BREAKDOWN:
${periodScores || 'Not available'}

SHOTS ON GOAL:
- Sabres: ${sabresTeam?.sog || 0}
- ${opponentTeam?.abbrev}: ${opponentTeam?.sog || 0}

SCORING SUMMARY:
${scoringSummary || 'No goals scored'}

GOALTENDING:
${goalieStats || 'Not available'}

POWER PLAY:
${powerPlayStats || 'Not available'}

PENALTIES:
${penaltySummary || 'No penalties'}

${threeStars ? `THREE STARS:\n${threeStars}` : ''}

═══════════════════════════════════════════════════════
`;
}

function generateTitle(isWin: boolean, sabresScore: number, oppScore: number, opponent: string, periodType: string): string {
  const margin = Math.abs(sabresScore - oppScore);
  const otSuffix = periodType === 'OT' ? ' in Overtime' : periodType === 'SO' ? ' in Shootout' : '';
  const winVerbs = ['Defeat', 'Top', 'Down', 'Beat', 'Edge', 'Clip'];
  const blowoutVerbs = ['Dominate', 'Rout', 'Crush'];

  if (isWin) {
    if (margin >= 4) return `Sabres ${blowoutVerbs[Math.floor(Math.random() * blowoutVerbs.length)]} ${opponent} ${sabresScore}-${oppScore}`;
    if (margin === 1 || periodType === 'OT' || periodType === 'SO') return `Sabres Edge ${opponent} ${sabresScore}-${oppScore}${otSuffix}`;
    return `Sabres ${winVerbs[Math.floor(Math.random() * winVerbs.length)]} ${opponent} ${sabresScore}-${oppScore}`;
  } else {
    if (margin >= 4) return `${opponent} Overwhelm Sabres ${oppScore}-${sabresScore}`;
    if (periodType === 'OT' || periodType === 'SO') return `Sabres Fall to ${opponent} ${oppScore}-${sabresScore}${otSuffix}`;
    return `Sabres Lose to ${opponent} ${oppScore}-${sabresScore}`;
  }
}

async function generateUniqueSlug(title: string, date: string, maxAttempts: number = 10) {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const titleSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;
  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) return baseSlug;
  for (let i = 2; i <= maxAttempts + 1; i++) { const s = `${baseSlug}-${i}`; if (!(await kv.get(`blog:slug:${s}`))) return s; }
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
    gameId: postData.gameId, opponent: postData.opponent, gameDate: postData.gameDate,
    aiGenerated: true, aiModel: postData.aiModel, metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);
  const score = post.publishedAt ? new Date(post.publishedAt).getTime() : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd(`blog:posts:${post.team}`, { score, member: id });
  await kv.zadd(`blog:posts:type:${post.type}`, { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);
  return post;
}

async function hasGameBeenProcessed(gameId: number) { return await kv.sismember('blog:gamerecap:processed', String(gameId)); }
async function markGameProcessed(gameId: number, postId: string, metadata: any) {
  await kv.sadd('blog:gamerecap:processed', String(gameId));
  await kv.set(`blog:gamerecap:log:${gameId}`, { processedAt: new Date().toISOString(), postId, ...metadata });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const schedule = await fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const completedGames = (schedule.games || [])
      .filter((g: any) => g.gameType === 2)
      .filter((g: any) => g.gameState === 'FINAL' || g.gameState === 'OFF')
      .filter((g: any) => new Date(g.gameDate) >= cutoff)
      .filter((g: any) => {
        const gameStartTime = new Date(g.startTimeUTC || g.gameDate);
        const estimatedEndTime = new Date(gameStartTime.getTime() + 3 * 60 * 60 * 1000);
        return now.getTime() - estimatedEndTime.getTime() >= GAME_END_BUFFER_MS;
      });

    const unprocessedGames = [];
    for (const game of completedGames) {
      if (!(await hasGameBeenProcessed(game.id))) unprocessedGames.push(game);
    }

    if (unprocessedGames.length === 0) {
      return NextResponse.json({ success: true, message: 'No new games to process', gamesFound: completedGames.length, gamesProcessed: 0 });
    }

    const results: any[] = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('game-recap');

    for (const game of unprocessedGames) {
      try {
        const boxData = await fetchGameBoxScore(game.id);
        if (!boxData) { results.push({ gameId: game.id, error: 'Failed to fetch box score' }); continue; }

        const verifiedGameData = formatBoxScore(boxData.boxscore, boxData.playByPlay, boxData.landing);
        const isHome = game.homeTeam?.abbrev === 'BUF';
        const sabresScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
        const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
        const oppTeam = isHome ? boxData.boxscore.awayTeam : boxData.boxscore.homeTeam;
        const opponent = oppTeam?.name?.default || oppTeam?.abbrev || 'Opponent';
        const oppAbbrev = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
        const isWin = sabresScore > oppScore;
        const periodType = game.gameOutcome?.lastPeriodType || 'REG';

        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514', max_tokens: 4096, system: GAME_RECAP_SYSTEM_PROMPT,
          messages: [{ role: 'user', content: `Write a game recap for the Buffalo Sabres based on the following verified box score data:\n\n${verifiedGameData}\n\nThe article should be 400-600 words.` }]
        });

        const content = message.content.filter((block: any) => block.type === 'text').map((block: any) => block.text).join('\n');
        const title = generateTitle(isWin, sabresScore, oppScore, opponent, periodType);
        const otSuffix = periodType === 'OT' ? ' in overtime' : periodType === 'SO' ? ' in a shootout' : '';
        const metaDescription = `Game recap: Buffalo Sabres ${isWin ? 'defeat' : 'fall to'} ${opponent} ${sabresScore}-${oppScore}${otSuffix}. Full breakdown and analysis.`;

        const post = await createPost({
          title, content, team: 'sabres', type: 'game-recap',
          status: autoPublish ? 'published' : 'draft',
          gameId: game.id, opponent: oppAbbrev, gameDate: game.gameDate, metaDescription, aiModel: 'claude-sonnet-4-20250514'
        });

        await markGameProcessed(game.id, post.id, { opponent: oppAbbrev, gameDate: game.gameDate, result: `${sabresScore}-${oppScore}` });
        results.push({ gameId: game.id, postId: post.id, postSlug: post.slug, status: post.status, title: post.title, opponent: oppAbbrev, result: `${isWin ? 'W' : 'L'} ${sabresScore}-${oppScore}` });
      } catch (error: any) {
        console.error(`Error processing game ${game.id}:`, error);
        results.push({ gameId: game.id, error: error.message });
      }
    }

    return NextResponse.json({ success: true, gamesFound: completedGames.length, gamesProcessed: results.filter((r: any) => !r.error).length, results });
  } catch (error: any) {
    console.error('Game recap cron error:', error);
    return NextResponse.json({ error: 'Failed to process game recaps', message: error.message }, { status: 500 });
  }
}
