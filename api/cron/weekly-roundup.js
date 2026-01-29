import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '../utils/fetchWithRetry.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';

// System prompt for weekly roundup generation
const WEEKLY_ROUNDUP_SYSTEM_PROMPT = `You are a professional sports journalist writing the weekly roundup for "Lindy's Five", a Buffalo Sabres fan blog.

Your task is to summarize the Sabres' week in review based on the verified data provided.

Structure your article with these sections:
1. **Opening** (2-3 sentences): Week overview - record, key narrative (hot streak? struggles? bounce back?)
2. **Game-by-Game** (2-3 sentences per game): Highlights from each game
3. **Star Performers**: Players who stood out across the week with specific stats
4. **Standings Update**: Where the team sits now, movement from last week
5. **Looking Ahead**: Next week's schedule and key matchups

Writing style:
- Professional sports journalism tone - analytical yet accessible
- Focus on the week as a whole, not just individual games
- Identify patterns, trends, and storylines across the week's games
- Be honest about struggles while remaining constructive
- Reference specific games and stats to support your analysis
- 600-900 words total

Format:
- Use Markdown with ## headers for each section
- Use **bold** for player names and key stats
- Do NOT include the word "TITLE:" or "META:" in your response

CRITICAL: Use ONLY the data provided in the VERIFIED WEEKLY DATA block. Do not make up stats or use external information.`;

// Fetch game box score data with retry logic
async function fetchGameBoxScore(gameId) {
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

    // Find Sabres in standings
    const sabres = data.standings?.find(t => t.teamAbbrev?.default === 'BUF');
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

// Get the previous Monday (start of last week)
function getLastMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7; // Previous week's Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Get the previous Sunday (end of last week)
function getLastSunday(date) {
  const monday = getLastMonday(date);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

// Format date for display
function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
}

// Find player name from box score stats
function findPlayerName(playerId, homeStats, awayStats) {
  const allPlayers = [
    ...(homeStats?.forwards || []),
    ...(homeStats?.defense || []),
    ...(homeStats?.goalies || []),
    ...(awayStats?.forwards || []),
    ...(awayStats?.defense || []),
    ...(awayStats?.goalies || [])
  ];
  const player = allPlayers.find(p => p.playerId === playerId);
  return player?.name?.default || 'Unknown';
}

// Extract top scorers from a game
function extractGameHighlights(boxData, isHome) {
  if (!boxData) return { topScorers: 'N/A', goalie: 'N/A' };

  const { boxscore, landing } = boxData;
  const sabresStats = isHome
    ? boxscore.playerByGameStats?.homeTeam
    : boxscore.playerByGameStats?.awayTeam;

  // Get top point getters
  const skaters = [...(sabresStats?.forwards || []), ...(sabresStats?.defense || [])];
  const pointGetters = skaters
    .filter(p => (p.goals || 0) + (p.assists || 0) > 0)
    .sort((a, b) => ((b.goals || 0) + (b.assists || 0)) - ((a.goals || 0) + (a.assists || 0)))
    .slice(0, 3)
    .map(p => `${p.name?.default} (${p.goals}G, ${p.assists}A)`)
    .join(', ');

  // Get starting goalie
  const goalies = sabresStats?.goalies || [];
  const starter = goalies.find(g => g.toi && g.toi !== '00:00') || goalies[0];
  const goalieText = starter
    ? `${starter.name?.default} (${starter.saveShotsAgainst || '0/0'}, ${starter.savePctg ? (starter.savePctg * 100).toFixed(1) + '%' : 'N/A'})`
    : 'N/A';

  return {
    topScorers: pointGetters || 'No scorers',
    goalie: goalieText
  };
}

// Format weekly data for AI prompt
function formatWeeklyContext(weekStart, weekEnd, games, boxScores, standings, upcomingGames) {
  // Calculate week record
  let wins = 0, otLosses = 0, losses = 0, goalsFor = 0, goalsAgainst = 0;
  const gameSummaries = [];

  games.forEach((game, i) => {
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
      date: game.gameDate,
      opponent: opponent?.abbrev || 'UNK',
      location: isHome ? 'Home' : 'Away',
      score: `${sabresScore}-${oppScore}`,
      result: `${result}${otLabel}`,
      topScorers,
      goalie
    });
  });

  const weekPoints = wins * 2 + otLosses;

  // Format upcoming games
  const upcomingText = upcomingGames.length > 0
    ? upcomingGames.map(g => {
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
${gameSummaries.map(g => `
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

// Generate weekly title based on performance
function generateWeeklyTitle(weekStart, wins, losses, otLosses) {
  const formattedDate = weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  const points = wins * 2 + otLosses;
  const totalGames = wins + losses + otLosses;

  if (totalGames === 0) return `Sabres Week in Review: ${formattedDate}`;

  if (wins >= 3 && losses === 0) return `Sabres Dominate: ${wins}-${losses}-${otLosses} Week`;
  if (wins === 0 && totalGames >= 2) return `Sabres Struggle: ${wins}-${losses}-${otLosses} Week`;
  if (points >= 4 && totalGames >= 3) return `Solid Week for the Sabres: ${wins}-${losses}-${otLosses}`;

  return `Sabres Week in Review: ${wins}-${losses}-${otLosses}`;
}

// Create post via internal API call pattern
async function createPost(postData) {
  // Generate slug
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = postData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const slug = `${titleSlug}-${dateStr}`;

  // Generate excerpt
  const plainText = postData.content
    .replace(/#{1,6}\s/g, '')
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\n+/g, ' ')
    .trim();
  const excerpt = truncateAtWordBoundary(plainText, 200, '...');

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
    weekStartDate: postData.weekStartDate,
    weekEndDate: postData.weekEndDate,
    aiGenerated: true,
    aiModel: 'claude-sonnet-4-20250514',
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

export default async function handler(req, res) {
  // Verify cron secret (Vercel sends this in authorization header)
  const authHeader = req.headers.authorization;
  const expectedAuth = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expectedAuth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Calculate date range (previous Monday to Sunday)
    const now = new Date();
    const weekStart = getLastMonday(now);
    const weekEnd = getLastSunday(now);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Check if we already generated this week's roundup
    const lastRoundupDate = await kv.get('blog:weekly:last');
    if (lastRoundupDate === weekStartStr) {
      return res.status(200).json({
        success: false,
        message: 'Weekly roundup already generated for this week',
        weekStart: weekStartStr
      });
    }

    // Fetch season schedule
    const scheduleRes = await fetch(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`);
    const schedule = await scheduleRes.json();

    // Filter games to those in the target week
    const weekGames = (schedule.games || [])
      .filter(g => g.gameType === 2) // Regular season only
      .filter(g => {
        const gameDate = new Date(g.gameDate);
        return gameDate >= weekStart && gameDate <= weekEnd;
      })
      .filter(g => g.gameState === 'FINAL' || g.gameState === 'OFF');

    if (weekGames.length === 0) {
      return res.status(200).json({
        success: false,
        message: 'No completed games found for this week',
        weekStart: weekStartStr
      });
    }

    // Fetch box scores for each game
    const boxScores = await Promise.all(
      weekGames.map(g => fetchGameBoxScore(g.id))
    );

    // Fetch current standings
    const standings = await fetchStandings();

    // Get upcoming games (next 5)
    const upcomingGames = (schedule.games || [])
      .filter(g => g.gameType === 2)
      .filter(g => g.gameState === 'FUT')
      .slice(0, 5);

    // Build context for AI
    const context = formatWeeklyContext(weekStart, weekEnd, weekGames, boxScores, standings, upcomingGames);

    // Calculate week stats for title
    let weekWins = 0, weekLosses = 0, weekOtLosses = 0;
    weekGames.forEach(game => {
      const isHome = game.homeTeam?.abbrev === 'BUF';
      const sabresScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
      const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
      const periodType = game.gameOutcome?.lastPeriodType || 'REG';

      if (sabresScore > oppScore) weekWins++;
      else if (periodType === 'OT' || periodType === 'SO') weekOtLosses++;
      else weekLosses++;
    });

    // Generate article with Claude
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: WEEKLY_ROUNDUP_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Write the weekly roundup article based on this data:\n\n${context}`
      }]
    });

    // Extract content from response
    const content = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Generate title and meta description
    const title = generateWeeklyTitle(weekStart, weekWins, weekLosses, weekOtLosses);
    const metaDescription = `Buffalo Sabres week in review: ${weekWins}-${weekLosses}-${weekOtLosses} from ${formatDate(weekStart)} to ${formatDate(weekEnd)}. Game recaps, standout performers, and standings update.`;

    // Determine publish status from KV settings (falls back to env var)
    const autoPublish = await getAutoPublishSetting('weekly');

    // Create the post
    const post = await createPost({
      title,
      content,
      team: 'sabres',
      type: 'weekly-roundup',
      status: autoPublish ? 'published' : 'draft',
      weekStartDate: weekStart.toISOString(),
      weekEndDate: weekEnd.toISOString(),
      metaDescription
    });

    // Mark this week as processed
    await kv.set('blog:weekly:last', weekStartStr);

    return res.status(200).json({
      success: true,
      postId: post.id,
      postSlug: post.slug,
      status: post.status,
      weekStart: weekStartStr,
      gamesProcessed: weekGames.length
    });

  } catch (error) {
    console.error('Weekly roundup generation error:', error);
    return res.status(500).json({
      error: 'Failed to generate weekly roundup',
      message: error.message
    });
  }
}
