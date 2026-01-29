import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';
import { fetchJsonWithRetry } from '../utils/fetchWithRetry.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// Set recap system prompt
const SET_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing a set recap for "Lindy's Five", a Buffalo Sabres fan blog focused on tracking the season in 5-game chunks called "sets."

Your task is to write an engaging, analytical set recap based ONLY on the verified data provided. Do NOT use web search - all the facts you need are in the data.

Context about "Lindy's Five":
- The blog tracks the Sabres season in 5-game "sets" (16-17 sets per season)
- Each set is evaluated based on points earned out of a maximum 10
- 6+ points in a set is considered a success (playoff pace)
- 5 points is break-even
- 0-4 points indicates struggles
- The blog name honors Lindy Ruff, beloved former Sabres coach

Writing style:
- Professional sports journalism tone - analytical yet accessible
- Focus on the set as a whole, not just individual games
- Identify patterns, trends, and storylines across the 5 games
- Be honest about struggles while remaining constructive
- Reference specific games to support your analysis

Structure:
- Opening: Set result, points earned, key takeaway
- Set narrative: How did the 5 games unfold? What was the story?
- What worked: Strengths and positive trends
- Areas of concern: Issues that need addressing
- Standout performances: Players who made an impact across the set
- Closing: What this set means for the season trajectory

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for player names and key stats
- Keep paragraphs concise (3-4 sentences max)
- Article should be 600-900 words

Set evaluation context:
- 10 points (5-0-0): Perfect set
- 8-9 points: Excellent performance
- 6-7 points: Successful set (playoff pace)
- 5 points: Break-even, needs improvement
- 3-4 points: Concerning struggles
- 0-2 points: Disastrous stretch

CRITICAL: Use ONLY the data provided in the VERIFIED SET DATA block. Do not invent any statistics, player names, or game details not explicitly listed.`;

// Fetch game box score data with retry logic
async function fetchGameBoxScore(gameId) {
  try {
    const [boxscore, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);

    // Verify essential data exists
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

// Format date helper
function formatDate(dateStr) {
  const date = new Date(dateStr + 'T12:00:00');
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Format set data into comprehensive context block
function formatSetData(setNumber, games, boxScores) {
  const startDate = games[0].gameDate;
  const endDate = games[games.length - 1].gameDate;
  const dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;

  // Calculate aggregate set statistics
  let totalWins = 0, totalOTL = 0, totalLosses = 0;
  let totalGoalsFor = 0, totalGoalsAgainst = 0;
  let totalShotsFor = 0, totalShotsAgainst = 0;

  // Process each game
  const gamesSummary = [];
  boxScores.forEach((boxData, index) => {
    if (!boxData) return;

    const game = games[index];
    const { boxscore, landing } = boxData;
    const isHome = boxscore.homeTeam?.abbrev === 'BUF';
    const sabresTeam = isHome ? boxscore.homeTeam : boxscore.awayTeam;
    const oppTeam = isHome ? boxscore.awayTeam : boxscore.homeTeam;

    const sabresScore = sabresTeam?.score || 0;
    const oppScore = oppTeam?.score || 0;
    const lastPeriodType = landing?.gameOutcome?.lastPeriodType || 'REG';

    // Determine outcome
    let outcome;
    if (sabresScore > oppScore) {
      outcome = 'W';
      totalWins++;
    } else if (lastPeriodType === 'OT' || lastPeriodType === 'SO') {
      outcome = 'OTL';
      totalOTL++;
    } else {
      outcome = 'L';
      totalLosses++;
    }

    // Aggregate stats
    totalGoalsFor += sabresScore;
    totalGoalsAgainst += oppScore;
    totalShotsFor += sabresTeam?.sog || 0;
    totalShotsAgainst += oppTeam?.sog || 0;

    // Build game summary
    const resultSuffix = lastPeriodType !== 'REG' ? ` (${lastPeriodType})` : '';
    gamesSummary.push({
      gameNum: index + 1,
      date: formatDate(game.gameDate),
      opponent: oppTeam?.name?.default || oppTeam?.abbrev,
      oppAbbrev: oppTeam?.abbrev,
      location: isHome ? 'Home' : 'Away',
      result: `${outcome}${resultSuffix}`,
      score: `${sabresScore}-${oppScore}`,
      sabresShots: sabresTeam?.sog || 0,
      oppShots: oppTeam?.sog || 0,
    });
  });

  const totalPoints = totalWins * 2 + totalOTL;
  const gamesPlayed = boxScores.filter((b) => b !== null).length;
  const maxPoints = gamesPlayed * 2;

  // Build game-by-game section
  let gameByGameText = '';
  gamesSummary.forEach((g) => {
    gameByGameText += `Game ${g.gameNum} (${g.date}): ${g.result} ${g.score} ${g.location === 'Home' ? 'vs' : '@'} ${g.oppAbbrev}
  - Location: ${g.location}
  - Shots: Sabres ${g.sabresShots} - ${g.oppAbbrev} ${g.oppShots}
`;
  });

  // Build opponents list
  const opponents = gamesSummary.map((g) => g.opponent).join(', ');

  // Calculate per-game averages
  const goalsForPerGame = gamesPlayed > 0 ? (totalGoalsFor / gamesPlayed).toFixed(2) : '0.00';
  const goalsAgainstPerGame = gamesPlayed > 0 ? (totalGoalsAgainst / gamesPlayed).toFixed(2) : '0.00';
  const shotsForPerGame = gamesPlayed > 0 ? (totalShotsFor / gamesPlayed).toFixed(1) : '0.0';
  const shotsAgainstPerGame = gamesPlayed > 0 ? (totalShotsAgainst / gamesPlayed).toFixed(1) : '0.0';
  const goalDifferential = totalGoalsFor - totalGoalsAgainst;
  const goalDiffStr = goalDifferential > 0 ? `+${goalDifferential}` : `${goalDifferential}`;

  return {
    context: `
═══════════════════════════════════════════════════════
VERIFIED SET DATA - Set #${setNumber}
Buffalo Sabres | ${dateRange} | 2025-26 Season
Source: Official NHL API Box Scores
═══════════════════════════════════════════════════════

SET OVERVIEW:
- Set Number: ${setNumber} of 17
- Date Range: ${dateRange}
- Record: ${totalWins}-${totalLosses}-${totalOTL} (${totalPoints} of ${maxPoints} points)
- Opponents: ${opponents}

SET STATISTICS:
- Goals For: ${totalGoalsFor} (${goalsForPerGame} per game)
- Goals Against: ${totalGoalsAgainst} (${goalsAgainstPerGame} per game)
- Goal Differential: ${goalDiffStr}
- Shots For: ${totalShotsFor} (${shotsForPerGame} per game)
- Shots Against: ${totalShotsAgainst} (${shotsAgainstPerGame} per game)

GAME-BY-GAME BREAKDOWN:
${gameByGameText}

═══════════════════════════════════════════════════════
STRICT INSTRUCTIONS:
- Write a NARRATIVE set recap using ONLY the data above
- DO NOT search the web - all facts are provided
- DO NOT invent any statistics not listed here
- Analyze trends across the 5 games
- Identify what worked and what didn't
- Reference specific games and outcomes
═══════════════════════════════════════════════════════
`,
    stats: {
      wins: totalWins,
      losses: totalLosses,
      otLosses: totalOTL,
      points: totalPoints,
      maxPoints,
      goalsFor: totalGoalsFor,
      goalsAgainst: totalGoalsAgainst,
      startDate,
      endDate
    },
    opponents
  };
}

// Generate dynamic title based on set performance
function generateSetTitle(setNumber, wins, losses, otLosses, points) {
  const record = `${wins}-${losses}-${otLosses}`;

  if (points >= 8) {
    return `Sabres Excel in Set ${setNumber}: ${record} (${points} Points)`;
  } else if (points >= 6) {
    return `Sabres Post Solid Set ${setNumber}: ${record} (${points} Points)`;
  } else if (points === 5) {
    return `Sabres Split Set ${setNumber}: ${record} (${points} Points)`;
  } else if (points >= 3) {
    return `Sabres Struggle in Set ${setNumber}: ${record} (${points} Points)`;
  } else {
    return `Sabres Stumble Through Set ${setNumber}: ${record} (${points} Points)`;
  }
}

// Generate a unique slug by checking for collisions
async function generateUniqueSlug(title, date, maxAttempts = 10) {
  const dateStr = new Date(date).toISOString().split('T')[0];
  const titleSlug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const baseSlug = `${titleSlug}-${dateStr}`;

  const existingId = await kv.get(`blog:slug:${baseSlug}`);
  if (!existingId) return baseSlug;

  for (let i = 2; i <= maxAttempts + 1; i++) {
    const suffixedSlug = `${baseSlug}-${i}`;
    const existingSuffixedId = await kv.get(`blog:slug:${suffixedSlug}`);
    if (!existingSuffixedId) {
      console.log(`Slug collision for "${baseSlug}", using "${suffixedSlug}"`);
      return suffixedSlug;
    }
  }

  const fallbackSlug = `${baseSlug}-${Date.now()}`;
  console.log(`Multiple slug collisions for "${baseSlug}", using timestamp fallback`);
  return fallbackSlug;
}

// Create post in KV
async function createPost(postData) {
  const now = new Date().toISOString();
  const slug = await generateUniqueSlug(postData.title, now);

  const excerpt = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
    .substring(0, 200) + '...';

  const id = crypto.randomUUID();

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
    setNumber: postData.setNumber,
    setStartDate: postData.setStartDate,
    setEndDate: postData.setEndDate,
    opponent: postData.opponent,
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

// Check if set has been processed
async function hasSetBeenProcessed(setNumber) {
  return await kv.sismember('blog:setrecap:processed', String(setNumber));
}

// Mark set as processed
async function markSetProcessed(setNumber, postId, metadata) {
  await kv.sadd('blog:setrecap:processed', String(setNumber));
  await kv.set(`blog:setrecap:log:${setNumber}`, {
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
    // Fetch season schedule with retry logic
    const schedule = await fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);

    // Get all completed regular season games
    const completedGames = (schedule.games || [])
      .filter(g => g.gameType === 2) // Regular season
      .filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF');

    const totalGames = completedGames.length;

    // Calculate current completed set number
    // Set is complete when we have 5, 10, 15, etc. games
    const completedSetCount = Math.floor(totalGames / 5);

    if (completedSetCount === 0) {
      return res.status(200).json({
        success: true,
        message: 'No completed sets yet',
        totalGames,
        completedSets: 0
      });
    }

    // Check the most recent completed set
    const latestSetNumber = completedSetCount;

    // Check if already processed
    if (await hasSetBeenProcessed(latestSetNumber)) {
      return res.status(200).json({
        success: true,
        message: `Set ${latestSetNumber} already processed`,
        totalGames,
        completedSets: completedSetCount,
        latestSet: latestSetNumber
      });
    }

    // Get the 5 games for this set
    const setStartIndex = (latestSetNumber - 1) * 5;
    const setEndIndex = setStartIndex + 5;
    const setGames = completedGames.slice(setStartIndex, setEndIndex);

    if (setGames.length < 5) {
      return res.status(200).json({
        success: true,
        message: `Set ${latestSetNumber} not complete yet`,
        totalGames,
        gamesInSet: setGames.length
      });
    }

    // Fetch box scores for all games in the set
    console.log(`Processing Set ${latestSetNumber} with games:`, setGames.map(g => g.id));

    const boxScorePromises = setGames.map(game => fetchGameBoxScore(game.id));
    const boxScores = await Promise.all(boxScorePromises);

    // Verify we got all box scores
    const validBoxScores = boxScores.filter(b => b !== null);
    if (validBoxScores.length < 5) {
      return res.status(500).json({
        error: 'Failed to fetch all box scores',
        fetched: validBoxScores.length,
        expected: 5
      });
    }

    // Format set data
    const { context: verifiedSetData, stats, opponents } = formatSetData(latestSetNumber, setGames, boxScores);

    // Generate article
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('set-recap');

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SET_RECAP_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write a set recap for the Buffalo Sabres' Set #${latestSetNumber} of the 2025-26 season:\n\n${verifiedSetData}\n\nThe article should be 600-900 words.`
      }]
    });

    const content = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Generate title and meta description
    const title = generateSetTitle(latestSetNumber, stats.wins, stats.losses, stats.otLosses, stats.points);
    const metaDescription = `Buffalo Sabres Set ${latestSetNumber} recap: ${stats.wins}-${stats.losses}-${stats.otLosses} (${stats.points} points) from ${formatDate(stats.startDate)} to ${formatDate(stats.endDate)}.`;

    // Create post
    const post = await createPost({
      title,
      content,
      team: 'sabres',
      type: 'set-recap',
      status: autoPublish ? 'published' : 'draft',
      setNumber: latestSetNumber,
      setStartDate: stats.startDate,
      setEndDate: stats.endDate,
      opponent: opponents,
      metaDescription,
      aiModel: 'claude-sonnet-4-20250514'
    });

    // Mark as processed
    await markSetProcessed(latestSetNumber, post.id, {
      record: `${stats.wins}-${stats.losses}-${stats.otLosses}`,
      points: stats.points,
      startDate: stats.startDate,
      endDate: stats.endDate
    });

    return res.status(200).json({
      success: true,
      setNumber: latestSetNumber,
      postId: post.id,
      postSlug: post.slug,
      status: post.status,
      title: post.title,
      record: `${stats.wins}-${stats.losses}-${stats.otLosses}`,
      points: stats.points
    });

  } catch (error) {
    console.error('Set recap cron error:', error);
    return res.status(500).json({
      error: 'Failed to process set recap',
      message: error.message
    });
  }
}
