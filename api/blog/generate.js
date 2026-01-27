import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';

// Helper to verify admin authentication
async function verifyAdmin(req) {
  const token = req.cookies?.admin_token;
  if (!token) return false;

  try {
    const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET);
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

// Fetch live NHL data for Sabres directly from NHL API
// Note: We fetch directly from api-web.nhle.com because Vercel rewrites
// don't apply to internal serverless-to-serverless requests
async function fetchSabresData() {
  const NHL_API_BASE = 'https://api-web.nhle.com/v1';

  try {
    // Fetch current season schedule (has all game results)
    const scheduleRes = await fetch(`${NHL_API_BASE}/club-schedule-season/BUF/20242025`);
    const schedule = await scheduleRes.json();

    // Fetch current roster
    const rosterRes = await fetch(`${NHL_API_BASE}/roster/BUF/current`);
    const roster = await rosterRes.json();

    return { schedule, roster };
  } catch (error) {
    console.error('Failed to fetch NHL data:', error);
    return null;
  }
}

// Format NHL data into context block for prompt
function formatNHLContext(schedule, roster, referenceDate) {
  // Calculate standings from schedule
  const playedGames = (schedule.games || [])
    .filter((g) => g.gameType === 2) // Regular season only
    .filter((g) => g.gameState === 'FINAL' || g.gameState === 'OFF');

  let wins = 0,
    otLosses = 0,
    losses = 0;
  playedGames.forEach((game) => {
    const isHome = game.homeTeam?.abbrev === 'BUF';
    const bufScore = isHome ? game.homeTeam?.score : game.awayTeam?.score;
    const oppScore = isHome ? game.awayTeam?.score : game.homeTeam?.score;
    const wentToOT =
      game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO';

    if (bufScore > oppScore) wins++;
    else if (wentToOT) otLosses++;
    else losses++;
  });

  const points = wins * 2 + otLosses;

  // Get last 5 games
  const recentGames = playedGames.slice(-5).reverse();
  const recentGamesText = recentGames
    .map((g) => {
      const isHome = g.homeTeam?.abbrev === 'BUF';
      const opp = isHome ? g.awayTeam?.abbrev : g.homeTeam?.abbrev;
      const bufScore = isHome ? g.homeTeam?.score : g.awayTeam?.score;
      const oppScore = isHome ? g.awayTeam?.score : g.homeTeam?.score;
      const result = bufScore > oppScore ? 'W' : bufScore < oppScore ? 'L' : 'OTL';
      return `${g.gameDate}: ${result} ${bufScore}-${oppScore} vs ${opp}`;
    })
    .join('\n');

  // Format roster (forwards, defense, goalies)
  const forwards =
    roster.forwards?.map((p) => p.firstName?.default + ' ' + p.lastName?.default).join(', ') ||
    'N/A';
  const defense =
    roster.defensemen?.map((p) => p.firstName?.default + ' ' + p.lastName?.default).join(', ') ||
    'N/A';
  const goalies =
    roster.goalies?.map((p) => p.firstName?.default + ' ' + p.lastName?.default).join(', ') ||
    'N/A';

  return `
═══════════════════════════════════════════════════════
VERIFIED SABRES DATA (as of ${referenceDate})
Source: Official NHL API - USE THESE STATS ONLY
═══════════════════════════════════════════════════════

CURRENT STANDINGS:
- Record: ${wins}-${losses}-${otLosses} (${points} points)
- Games Played: ${playedGames.length}

LAST 5 GAMES:
${recentGamesText || 'No recent games found'}

CURRENT ROSTER:
Forwards: ${forwards}
Defense: ${defense}
Goalies: ${goalies}

═══════════════════════════════════════════════════════
IMPORTANT: The stats above are verified and current.
Use ONLY these numbers for points, record, and roster.
Do NOT use different stats from web search results.
═══════════════════════════════════════════════════════
`;
}

// Fetch live NFL data for Bills from ESPN API
async function fetchBillsData() {
  try {
    // Fetch standings
    const standingsRes = await fetch(
      'https://site.api.espn.com/apis/v2/sports/football/nfl/standings'
    );
    const standings = await standingsRes.json();

    // Fetch roster (Bills team ID = 2)
    const rosterRes = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/2/roster'
    );
    const roster = await rosterRes.json();

    return { standings, roster };
  } catch (error) {
    console.error('Failed to fetch NFL data:', error);
    return null;
  }
}

// Format Bills data into context block for prompt
function formatBillsContext(standings, roster, referenceDate) {
  // Find Bills in standings (AFC East)
  let billsRecord = 'N/A';
  let divisionPosition = 'N/A';

  try {
    // ESPN standings structure: children[conference].standings.entries[]
    const afcConf = standings.children?.find((conf) => conf.abbreviation === 'AFC');
    const afcEast = afcConf?.children?.find((div) => div.name === 'AFC East');
    const billsEntry = afcEast?.standings?.entries?.find(
      (entry) => entry.team?.abbreviation === 'BUF'
    );

    if (billsEntry) {
      const overallStat = billsEntry.stats?.find((s) => s.name === 'overall');
      billsRecord = overallStat?.displayValue || 'N/A';

      // Get position in division
      const position = afcEast?.standings?.entries?.findIndex(
        (e) => e.team?.abbreviation === 'BUF'
      );
      if (position !== -1) {
        divisionPosition = `${position + 1}${['st', 'nd', 'rd', 'th'][position] || 'th'} in AFC East`;
      }
    }
  } catch (e) {
    console.error('Error parsing standings:', e);
  }

  // Format roster - get key players
  let keyPlayers = [];
  try {
    roster.athletes?.forEach((group) => {
      group.items?.slice(0, 5).forEach((player) => {
        keyPlayers.push(`${player.fullName} (${player.position?.abbreviation || 'N/A'})`);
      });
    });
  } catch (e) {
    console.error('Error parsing roster:', e);
  }

  return `
═══════════════════════════════════════════════════════
VERIFIED BILLS DATA (as of ${referenceDate})
Source: ESPN API - USE THESE STATS ONLY
═══════════════════════════════════════════════════════

CURRENT STANDINGS:
- Record: ${billsRecord}
- Division: ${divisionPosition}

KEY PLAYERS ON ROSTER:
${keyPlayers.slice(0, 20).join(', ') || 'N/A'}

═══════════════════════════════════════════════════════
IMPORTANT: The stats above are verified and current.
Use ONLY these numbers for record and standings.
Do NOT use different stats from web search results.
═══════════════════════════════════════════════════════
`;
}

// Fetch complete box score data for a specific game directly from NHL API
// Note: We fetch directly from api-web.nhle.com because Vercel rewrites
// don't apply to internal serverless-to-serverless requests
async function fetchGameBoxScore(gameId) {
  const NHL_API_BASE = 'https://api-web.nhle.com/v1';

  try {
    // Fetch boxscore (scores, shots, goalie stats)
    const boxscoreRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`);
    const boxscore = await boxscoreRes.json();

    // Fetch play-by-play (goals with times/assists, penalties)
    const pbpRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`);
    const playByPlay = await pbpRes.json();

    // Fetch landing page for additional game context
    const landingRes = await fetch(`${NHL_API_BASE}/gamecenter/${gameId}/landing`);
    const landing = await landingRes.json();

    return { boxscore, playByPlay, landing };
  } catch (error) {
    console.error('Failed to fetch game box score:', error);
    return null;
  }
}

// Format box score data into comprehensive context block
function formatBoxScore(boxscore, playByPlay, landing) {
  // Determine which team is Sabres and which is opponent
  const isHomeTeamSabres = boxscore.homeTeam?.abbrev === 'BUF';
  const sabresTeam = isHomeTeamSabres ? boxscore.homeTeam : boxscore.awayTeam;
  const opponentTeam = isHomeTeamSabres ? boxscore.awayTeam : boxscore.homeTeam;
  const sabresPlayerStats = isHomeTeamSabres
    ? boxscore.playerByGameStats?.homeTeam
    : boxscore.playerByGameStats?.awayTeam;
  const opponentPlayerStats = isHomeTeamSabres
    ? boxscore.playerByGameStats?.awayTeam
    : boxscore.playerByGameStats?.homeTeam;

  // Get game date
  const gameDate = landing?.gameDate || boxscore.gameDate || 'Unknown Date';
  const formattedDate = new Date(gameDate + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Determine result
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

  // Shots on goal
  const sabresShots = sabresTeam?.sog || 0;
  const opponentShots = opponentTeam?.sog || 0;

  // Extract all goals from play-by-play
  let scoringSummary = '';
  const goals = (playByPlay?.plays || []).filter((p) => p.typeDescKey === 'goal');
  goals.forEach((goal) => {
    const period = goal.periodDescriptor?.number || '?';
    const periodType = goal.periodDescriptor?.periodType || 'REG';
    const periodLabel = periodType === 'OT' ? 'OT' : `P${period}`;
    const time = goal.timeInPeriod || '??:??';
    const teamAbbrev = goal.details?.eventOwnerTeamId === sabresTeam?.id ? 'BUF' : opponentTeam?.abbrev;

    // Get scorer and assists
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

    // Goal type
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
  const oppPP = landing?.summary?.teamGameStats?.find((s) => s.category === 'powerPlay');
  let powerPlayStats = '';
  if (sabresPP) {
    const sabresVal = isHomeTeamSabres ? sabresPP.homeValue : sabresPP.awayValue;
    const oppVal = isHomeTeamSabres ? sabresPP.awayValue : sabresPP.homeValue;
    powerPlayStats = `- Sabres: ${sabresVal}\n- ${opponentTeam?.abbrev}: ${oppVal}`;
  }

  // Penalties from play-by-play
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

  // Three stars if available
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

// Extract featured image from landing data
// NHL API doesn't provide video thumbnails directly, so we use first goal scorer's headshot
function extractHighlightImage(landing) {
  try {
    // Get the current season for headshot URL (format: 20252026)
    const currentYear = new Date().getFullYear();
    const season = `${currentYear}${currentYear + 1}`;

    // Try to get first goal scorer's headshot from scoring summary
    const scoring = landing?.summary?.scoring;
    if (scoring && Array.isArray(scoring)) {
      for (const period of scoring) {
        if (period.goals && period.goals.length > 0) {
          const firstGoal = period.goals[0];
          // Get the scorer's player ID and team
          if (firstGoal.playerId && firstGoal.teamAbbrev?.default) {
            const playerId = firstGoal.playerId;
            const team = firstGoal.teamAbbrev.default;
            // NHL headshot URL pattern
            return `https://assets.nhle.com/mugs/nhl/${season}/${team}/${playerId}.png`;
          }
        }
      }
    }

    // Fallback: Use Sabres team logo if no goals found
    return null;
  } catch (error) {
    console.error('Error extracting highlight image:', error);
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

// Game recap specific system prompt
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

// Sports journalism system prompt
const SYSTEM_PROMPT = `You are a professional sports journalist writing for "Lindy's Five", a Buffalo sports blog covering the Sabres (NHL) and Bills (NFL).

Your writing style:
- Professional sports journalism tone - authoritative yet accessible
- Analytical with specific stats and observations to support your points
- Objective analysis with measured opinions backed by evidence
- When expressing opinions, frame them professionally (e.g., "the data suggests...", "it's worth noting that...", "this raises questions about...")
- Maintain journalistic integrity - present facts first, opinions second
- Use clear, descriptive language for game action without hyperbole
- Include relevant context (standings, streaks, historical comparisons)
- Reference specific players, plays, and moments when applicable
- Avoid snark, hot takes, or overly casual language
- Avoid clickbait-style phrasing or exaggerated claims

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for emphasis on key stats or player names
- Keep paragraphs concise (3-4 sentences max)
- Include a compelling but professional opening
- End with thoughtful analysis or forward-looking perspective

Team context:
- Sabres: NHL team in Buffalo, NY. Colors: blue and gold. Arena: KeyBank Center.
- Bills: NFL team in Buffalo, NY. Colors: red, blue, white. Stadium: Highmark Stadium.

ACCURACY REQUIREMENTS:
- When VERIFIED DATA is provided in the prompt, use ONLY those stats for standings, points, record, and roster
- If web search returns different point totals or records than the VERIFIED DATA, trust the VERIFIED DATA
- For player names, only reference players confirmed on the current roster in the VERIFIED DATA
- Never invent specific statistics (point totals, goal counts, save percentages, passing yards) unless provided
- If you cannot verify a fact, use hedging language ("according to recent reports", "the team has reportedly...")
- If uncertain about a detail, omit it rather than guess
- Cite sources when using information from web search (e.g., "per ESPN", "according to The Athletic")

IMPORTANT: Write ORIGINAL content only. Never copy from other sources. Create your own narrative and analysis based on the facts provided.`;

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify admin authentication
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { idea, team, title, researchEnabled = false, allowedDomains, referenceDate, gameId, postType } = req.body;

  // Validate required fields
  if (!idea || !team) {
    return res.status(400).json({
      error: 'Missing required fields: idea and team are required',
    });
  }

  // For game recaps, validate gameId
  if (postType === 'game-recap' && !gameId) {
    return res.status(400).json({
      error: 'gameId is required for game recap generation',
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'AI service not configured',
      details: 'ANTHROPIC_API_KEY environment variable is not set',
    });
  }

  try {
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    // Handle game recap generation with box score injection
    if (postType === 'game-recap' && gameId && team === 'sabres') {
      console.log(`Generating game recap for gameId: ${gameId}`);

      const boxData = await fetchGameBoxScore(gameId);
      if (!boxData) {
        return res.status(500).json({
          error: 'Failed to fetch game box score',
          details: 'Could not retrieve game data from NHL API',
        });
      }

      const verifiedGameData = formatBoxScore(boxData.boxscore, boxData.playByPlay, boxData.landing);
      const highlightImage = extractHighlightImage(boxData.landing);
      console.log('Injected verified box score data into prompt');
      console.log('Highlight image:', highlightImage || 'none found');

      const recapPrompt = `Write a game recap for the Buffalo Sabres based on the following verified box score data:

${verifiedGameData}

${idea}

${title ? `Suggested title: "${title}"` : 'Please also suggest a compelling, SEO-friendly title.'}

Please provide your response in this exact format:
TITLE: [Your title here]
META: [A brief meta description for SEO, max 160 characters]
---
[Article content in Markdown format]

The article should be 400-600 words and follow the style guidelines provided.`;

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: GAME_RECAP_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: recapPrompt }],
        // NO web search tools for game recaps - we have all the data
      });

      // Extract text content from the response
      const textContent = message.content
        .filter((block) => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // Parse the response
      const titleMatch = textContent.match(/^TITLE:\s*(.+)$/m);
      const metaMatch = textContent.match(/^META:\s*(.+)$/m);
      const contentSplit = textContent.split('---\n');

      const generatedTitle = titleMatch ? titleMatch[1].trim() : title || 'Sabres Game Recap';
      const metaDescription = metaMatch ? metaMatch[1].trim().slice(0, 160) : '';
      const content =
        contentSplit.length > 1 ? contentSplit.slice(1).join('---\n').trim() : textContent;

      return res.status(200).json({
        success: true,
        content,
        title: generatedTitle,
        metaDescription,
        model: 'claude-sonnet-4-20250514',
        highlightImage: highlightImage || null,
      });
    }

    // Regular article generation flow (custom articles)
    // Build the user prompt
    const teamName = team === 'sabres' ? 'Buffalo Sabres' : 'Buffalo Bills';
    const currentDate = referenceDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    // Fetch verified data from official APIs
    let verifiedDataContext = '';
    if (team === 'sabres') {
      const sabresData = await fetchSabresData();
      if (sabresData?.schedule && sabresData?.roster) {
        verifiedDataContext = formatNHLContext(sabresData.schedule, sabresData.roster, currentDate);
        console.log('Injected verified Sabres data into prompt');
      } else {
        console.warn('Failed to fetch Sabres data - falling back to web search only');
      }
    } else if (team === 'bills') {
      const billsData = await fetchBillsData();
      if (billsData?.standings && billsData?.roster) {
        verifiedDataContext = formatBillsContext(billsData.standings, billsData.roster, currentDate);
        console.log('Injected verified Bills data into prompt');
      } else {
        console.warn('Failed to fetch Bills data - falling back to web search only');
      }
    }

    // Add research instructions if enabled
    const dateContext = referenceDate ? `\n\nTODAY'S DATE: ${referenceDate}` : '';
    const researchInstructions = researchEnabled
      ? `${dateContext}

RESEARCH GUIDELINES:
${verifiedDataContext ? 'The VERIFIED DATA above contains accurate standings and roster information from official APIs.' : ''}
You may use web search for:
- Recent news and storylines
- Injury updates and transactions not reflected in roster data
- Quotes from players/coaches
- Historical context and comparisons
- Upcoming schedule analysis

${verifiedDataContext ? 'Do NOT search for or override the standings/points/record data provided in VERIFIED DATA above.\nIf web search returns different point totals or records, trust the VERIFIED DATA.' : 'Search for current standings, roster, and recent game information.'}
${
          allowedDomains?.length
            ? `\nTrusted sources to prioritize: ${allowedDomains.join(', ')}`
            : ''
        }`
      : '';

    const userPrompt = `Write an article for the ${teamName} based on the following idea:
${verifiedDataContext}
${idea}${researchInstructions}

${title ? `Suggested title: "${title}"` : 'Please also suggest a compelling, SEO-friendly title.'}

Please provide your response in this exact format:
TITLE: [Your title here]
META: [A brief meta description for SEO, max 160 characters]
---
[Article content in Markdown format]

The article should be 400-800 words and follow the style guidelines provided.`;

    // Configure web search tool if research is enabled
    const tools = researchEnabled
      ? [{ type: 'web_search_20250305', name: 'web_search' }]
      : undefined;

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
      ...(tools && { tools }),
    });

    // Extract text content from the response
    const textContent = message.content
      .filter((block) => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    // Parse the response
    const titleMatch = textContent.match(/^TITLE:\s*(.+)$/m);
    const metaMatch = textContent.match(/^META:\s*(.+)$/m);
    const contentSplit = textContent.split('---\n');

    const generatedTitle = titleMatch ? titleMatch[1].trim() : title || 'Untitled Article';
    const metaDescription = metaMatch ? metaMatch[1].trim().slice(0, 160) : '';
    const content =
      contentSplit.length > 1 ? contentSplit.slice(1).join('---\n').trim() : textContent;

    return res.status(200).json({
      success: true,
      content,
      title: generatedTitle,
      metaDescription,
      model: 'claude-sonnet-4-20250514',
    });
  } catch (error) {
    console.error('Error generating article:', error);

    // Handle specific Anthropic errors
    if (error.status === 429) {
      return res.status(429).json({
        error: 'Rate limit exceeded. Please try again in a moment.',
        details: error.message,
      });
    }

    if (error.status === 401) {
      return res.status(500).json({
        error: 'AI service authentication failed',
        details: 'Invalid API key. Please check ANTHROPIC_API_KEY in Vercel settings.',
      });
    }

    if (error.status === 400) {
      return res.status(400).json({
        error: 'Invalid request to AI service.',
        details: error.message,
      });
    }

    // Generic error with more details
    return res.status(500).json({
      error: 'Failed to generate article',
      details: error.message || 'Unknown error',
      errorType: error.name || 'Error',
      status: error.status || null,
    });
  }
}
