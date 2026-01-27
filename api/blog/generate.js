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

// Fetch live NHL data for Sabres
async function fetchSabresData() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    // Fetch current season schedule (has all game results)
    const scheduleRes = await fetch(`${baseUrl}/api/nhl-api?endpoint=club-schedule-season/BUF/20242025`);
    const schedule = await scheduleRes.json();

    // Fetch current roster
    const rosterRes = await fetch(`${baseUrl}/api/nhl-api?endpoint=roster/BUF/current`);
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

  const { idea, team, title, researchEnabled = false, allowedDomains, referenceDate } = req.body;

  // Validate required fields
  if (!idea || !team) {
    return res.status(400).json({
      error: 'Missing required fields: idea and team are required',
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
