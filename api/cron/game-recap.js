import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// Game recap system prompt (same as generate.js)
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

// Fetch game box score data
async function fetchGameBoxScore(gameId) {
  try {
    const boxscoreRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`);
    const boxscore = await boxscoreRes.json();

    const pbpRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`);
    const playByPlay = await pbpRes.json();

    const landingRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/landing`);
    const landing = await landingRes.json();

    return { boxscore, playByPlay, landing };
  } catch (error) {
    console.error(`Failed to fetch box score for game ${gameId}:`, error);
    return null;
  }
}

// Helper to find player name by ID
function findPlayerName(playerId, sabresStats, opponentStats) {
  const allPlayers = [
    ...(sabresStats?.forwards || []),
    ...(sabresStats?.defense || []),
    ...(sabresStats?.goalies || []),
    ...(opponentStats?.forwards || []),
    ...(opponentStats?.defense || []),
    ...(opponentStats?.goalies || []),
  ];
  const player = allPlayers.find((p) => p.playerId === playerId);
  return player?.name?.default || 'Unknown';
}

// Format box score data into context block
function formatBoxScore(boxscore, playByPlay, landing) {
  const isHomeTeamSabres = boxscore.homeTeam?.abbrev === 'BUF';
  const sabresTeam = isHomeTeamSabres ? boxscore.homeTeam : boxscore.awayTeam;
  const opponentTeam = isHomeTeamSabres ? boxscore.awayTeam : boxscore.homeTeam;
  const sabresPlayerStats = isHomeTeamSabres
    ? boxscore.playerByGameStats?.homeTeam
    : boxscore.playerByGameStats?.awayTeam;
  const opponentPlayerStats = isHomeTeamSabres
    ? boxscore.playerByGameStats?.awayTeam
    : boxscore.playerByGameStats?.homeTeam;

  const gameDate = landing?.gameDate || boxscore.gameDate || 'Unknown Date';
  const formattedDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const sabresScore = sabresTeam?.score || 0;
  const opponentScore = opponentTeam?.score || 0;
  const result = sabresScore > opponentScore ? 'WIN' : 'LOSS';
  const lastPeriodType = landing?.gameOutcome?.lastPeriodType || 'REG';
  const resultSuffix = lastPeriodType === 'OT' ? ' (OT)' : lastPeriodType === 'SO' ? ' (SO)' : '';

  // Period-by-period scores
  let periodScores = '';
  const periods = landing?.summary?.scoring || [];
  periods.forEach((period, idx) => {
    const sabresGoals = isHomeTeamSabres ? period.homeScore : period.awayScore;
    const oppGoals = isHomeTeamSabres ? period.awayScore : period.homeScore;
    const periodName = period.periodDescriptor?.periodType === 'OT' ? 'OT' : `Period ${idx + 1}`;
    periodScores += `${periodName}: Sabres ${sabresGoals} - ${opponentTeam?.abbrev} ${oppGoals}\n`;
  });

  const sabresShots = sabresTeam?.sog || 0;
  const opponentShots = opponentTeam?.sog || 0;

  // Extract goals from play-by-play
  let scoringSummary = '';
  const goals = (playByPlay?.plays || []).filter((p) => p.typeDescKey === 'goal');
  goals.forEach((goal) => {
    const period = goal.periodDescriptor?.number || '?';
    const periodType = goal.periodDescriptor?.periodType || 'REG';
    const periodLabel = periodType === 'OT' ? 'OT' : `P${period}`;
    const time = goal.timeInPeriod || '??:??';
    const teamAbbrev = goal.details?.eventOwnerTeamId === sabresTeam?.id ? 'BUF' : opponentTeam?.abbrev;

    const scorer = goal.details?.scoringPlayerId
      ? findPlayerName(goal.details.scoringPlayerId, sabresPlayerStats, opponentPlayerStats)
      : 'Unknown';
    const assists = [];
    if (goal.details?.assist1PlayerId) {
      assists.push(findPlayerName(goal.details.assist1PlayerId, sabresPlayerStats, opponentPlayerStats));
    }
    if (goal.details?.assist2PlayerId) {
      assists.push(findPlayerName(goal.details.assist2PlayerId, sabresPlayerStats, opponentPlayerStats));
    }
    const assistsText = assists.length > 0 ? `(${assists.join(', ')})` : '(unassisted)';

    let goalType = '';
    if (goal.details?.goalModifier === 'power-play') goalType = ' [PP]';
    else if (goal.details?.goalModifier === 'short-handed') goalType = ' [SH]';
    else if (goal.details?.goalModifier === 'empty-net') goalType = ' [EN]';
    else goalType = ' [EV]';

    scoringSummary += `- ${periodLabel} ${time}: ${teamAbbrev} - ${scorer} ${assistsText}${goalType}\n`;
  });

  // Goalie stats
  let goalieStats = '';
  const sabresGoalies = sabresPlayerStats?.goalies || [];
  const opponentGoalies = opponentPlayerStats?.goalies || [];

  sabresGoalies.forEach((g) => {
    const name = `${g.name?.default || 'Unknown'}`;
    const saves = g.saveShotsAgainst?.split('/')[0] || g.saves || 0;
    const shotsAgainst = g.saveShotsAgainst?.split('/')[1] || g.shotsAgainst || 0;
    const savePct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(1) : '0.0';
    goalieStats += `Sabres: ${name} - ${saves} saves on ${shotsAgainst} shots (${savePct}% SV%)\n`;
  });

  opponentGoalies.forEach((g) => {
    const name = `${g.name?.default || 'Unknown'}`;
    const saves = g.saveShotsAgainst?.split('/')[0] || g.saves || 0;
    const shotsAgainst = g.saveShotsAgainst?.split('/')[1] || g.shotsAgainst || 0;
    const savePct = shotsAgainst > 0 ? ((saves / shotsAgainst) * 100).toFixed(1) : '0.0';
    goalieStats += `${opponentTeam?.abbrev}: ${name} - ${saves} saves on ${shotsAgainst} shots (${savePct}% SV%)\n`;
  });

  // Power play stats
  const sabresPP = landing?.summary?.teamGameStats?.find((s) => s.category === 'powerPlay');
  let powerPlayStats = '';
  if (sabresPP) {
    const sabresVal = isHomeTeamSabres ? sabresPP.homeValue : sabresPP.awayValue;
    const oppVal = isHomeTeamSabres ? sabresPP.awayValue : sabresPP.homeValue;
    powerPlayStats = `- Sabres: ${sabresVal}\n- ${opponentTeam?.abbrev}: ${oppVal}`;
  }

  // Penalties
  let penaltySummary = '';
  const penalties = (playByPlay?.plays || []).filter((p) => p.typeDescKey === 'penalty');
  penalties.slice(0, 10).forEach((pen) => {
    const period = pen.periodDescriptor?.number || '?';
    const periodType = pen.periodDescriptor?.periodType || 'REG';
    const periodLabel = periodType === 'OT' ? 'OT' : `P${period}`;
    const time = pen.timeInPeriod || '??:??';
    const teamAbbrev = pen.details?.eventOwnerTeamId === sabresTeam?.id ? 'BUF' : opponentTeam?.abbrev;
    const player = pen.details?.committedByPlayerId
      ? findPlayerName(pen.details.committedByPlayerId, sabresPlayerStats, opponentPlayerStats)
      : 'Unknown';
    const infraction = pen.details?.descKey || 'penalty';
    const minutes = pen.details?.duration || 2;
    penaltySummary += `- ${periodLabel} ${time}: ${teamAbbrev} ${player} - ${infraction} (${minutes} min)\n`;
  });

  // Three stars
  let threeStars = '';
  if (landing?.summary?.threeStars?.length > 0) {
    landing.summary.threeStars.forEach((star, idx) => {
      const starNum = idx + 1;
      threeStars += `${starNum}. ${star.name?.default || 'Unknown'} (${star.teamAbbrev?.default || '?'})\n`;
    });
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
- Sabres: ${sabresShots}
- ${opponentTeam?.abbrev}: ${opponentShots}

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
STRICT INSTRUCTIONS:
- Write a NARRATIVE game recap using ONLY the data above
- DO NOT search the web - all facts are provided
- DO NOT invent any statistics not listed here
- Reference specific players, goals, and moments from the data
═══════════════════════════════════════════════════════
`;
}

// Generate dynamic title based on game result
function generateTitle(isWin, sabresScore, oppScore, opponent, periodType) {
  const margin = Math.abs(sabresScore - oppScore);
  const otSuffix = periodType === 'OT' ? ' in Overtime' : periodType === 'SO' ? ' in Shootout' : '';

  // Win titles
  const winVerbs = ['Defeat', 'Top', 'Down', 'Beat', 'Edge', 'Clip'];
  const blowoutVerbs = ['Dominate', 'Rout', 'Crush'];

  if (isWin) {
    if (margin >= 4) {
      const verb = blowoutVerbs[Math.floor(Math.random() * blowoutVerbs.length)];
      return `Sabres ${verb} ${opponent} ${sabresScore}-${oppScore}`;
    } else if (margin === 1 || periodType === 'OT' || periodType === 'SO') {
      return `Sabres Edge ${opponent} ${sabresScore}-${oppScore}${otSuffix}`;
    } else {
      const verb = winVerbs[Math.floor(Math.random() * winVerbs.length)];
      return `Sabres ${verb} ${opponent} ${sabresScore}-${oppScore}`;
    }
  } else {
    // Loss titles
    if (margin >= 4) {
      return `${opponent} Overwhelm Sabres ${oppScore}-${sabresScore}`;
    } else if (periodType === 'OT' || periodType === 'SO') {
      return `Sabres Fall to ${opponent} ${oppScore}-${sabresScore}${otSuffix}`;
    } else {
      return `Sabres Lose to ${opponent} ${oppScore}-${sabresScore}`;
    }
  }
}

// Create post in KV (same pattern as weekly-roundup.js)
async function createPost(postData) {
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = postData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const slug = `${titleSlug}-${dateStr}`;

  const excerpt = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 200) + '...';

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const post = {
    id,
    slug,
    title: postData.title,
    content: postData.content,
    excerpt,
    team: postData.team,
    type: postData.type,
    status: postData.status,
    createdAt: now,
    publishedAt: postData.status === 'published' ? now : null,
    updatedAt: now,
    gameId: postData.gameId,
    opponent: postData.opponent,
    gameDate: postData.gameDate,
    aiGenerated: true,
    aiModel: postData.aiModel,
    metaDescription: postData.metaDescription
  };

  // Save to KV
  await kv.set(`blog:post:${id}`, post);

  const score = post.publishedAt
    ? new Date(post.publishedAt).getTime()
    : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd(`blog:posts:${post.team}`, { score, member: id });
  await kv.zadd(`blog:posts:type:${post.type}`, { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);

  return post;
}

// Check if game has been processed
async function hasGameBeenProcessed(gameId) {
  return await kv.sismember('blog:gamerecap:processed', String(gameId));
}

// Mark game as processed
async function markGameProcessed(gameId, postId, metadata) {
  await kv.sadd('blog:gamerecap:processed', String(gameId));
  await kv.set(`blog:gamerecap:log:${gameId}`, {
    processedAt: new Date().toISOString(),
    postId,
    ...metadata
  });
}

export default async function handler(req, res) {
  // Verify cron secret
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Fetch season schedule
    const scheduleRes = await fetch(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const schedule = await scheduleRes.json();

    // Find completed games in the last 48 hours
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const completedGames = (schedule.games || [])
      .filter(g => g.gameType === 2) // Regular season
      .filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF')
      .filter(g => new Date(g.gameDate) >= cutoff);

    // Filter to unprocessed games
    const unprocessedGames = [];
    for (const game of completedGames) {
      if (!(await hasGameBeenProcessed(game.id))) {
        unprocessedGames.push(game);
      }
    }

    if (unprocessedGames.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new games to process',
        gamesFound: completedGames.length,
        gamesProcessed: 0
      });
    }

    // Process each unprocessed game
    const results = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = process.env.AUTO_PUBLISH_GAME_RECAP === 'true';

    for (const game of unprocessedGames) {
      try {
        // Fetch box score
        const boxData = await fetchGameBoxScore(game.id);
        if (!boxData) {
          results.push({ gameId: game.id, error: 'Failed to fetch box score' });
          continue;
        }

        // Format context
        const verifiedGameData = formatBoxScore(boxData.boxscore, boxData.playByPlay, boxData.landing);

        // Determine game details
        const isHome = game.homeTeam?.abbrev === 'BUF';
        const sabresScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
        const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
        const opponent = isHome ? game.awayTeam?.name?.default : game.homeTeam?.name?.default;
        const oppAbbrev = isHome ? game.awayTeam?.abbrev : game.homeTeam?.abbrev;
        const isWin = sabresScore > oppScore;
        const periodType = game.gameOutcome?.lastPeriodType || 'REG';

        // Generate article
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: GAME_RECAP_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Write a game recap for the Buffalo Sabres based on the following verified box score data:\n\n${verifiedGameData}\n\nThe article should be 400-600 words.`
          }]
        });

        const content = message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        // Generate title
        const title = generateTitle(isWin, sabresScore, oppScore, opponent, periodType);

        // Generate meta description
        const otSuffix = periodType === 'OT' ? ' in overtime' : periodType === 'SO' ? ' in a shootout' : '';
        const metaDescription = `Game recap: Buffalo Sabres ${isWin ? 'defeat' : 'fall to'} ${opponent} ${sabresScore}-${oppScore}${otSuffix}. Full breakdown and analysis.`;

        // Create post
        const post = await createPost({
          title,
          content,
          team: 'sabres',
          type: 'game-recap',
          status: autoPublish ? 'published' : 'draft',
          gameId: game.id,
          opponent: oppAbbrev,
          gameDate: game.gameDate,
          metaDescription,
          aiModel: 'claude-sonnet-4-20250514'
        });

        // Mark as processed
        await markGameProcessed(game.id, post.id, {
          opponent: oppAbbrev,
          gameDate: game.gameDate,
          result: `${sabresScore}-${oppScore}`
        });

        results.push({
          gameId: game.id,
          postId: post.id,
          postSlug: post.slug,
          status: post.status,
          title: post.title,
          opponent: oppAbbrev,
          result: `${isWin ? 'W' : 'L'} ${sabresScore}-${oppScore}`
        });

      } catch (error) {
        console.error(`Error processing game ${game.id}:`, error);
        results.push({ gameId: game.id, error: error.message });
      }
    }

    return res.status(200).json({
      success: true,
      gamesFound: completedGames.length,
      gamesProcessed: results.filter(r => !r.error).length,
      results
    });

  } catch (error) {
    console.error('Game recap cron error:', error);
    return res.status(500).json({
      error: 'Failed to process game recaps',
      message: error.message
    });
  }
}
