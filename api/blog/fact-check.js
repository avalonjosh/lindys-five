import Anthropic from '@anthropic-ai/sdk';
import { jwtVerify } from 'jose';
import { fetchJsonWithRetry } from '../utils/fetchWithRetry.js';

const NHL_API_BASE = 'https://api-web.nhle.com/v1';
const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

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

// Fetch Sabres data for fact checking
async function fetchSabresData() {
  try {
    const today = new Date().toISOString().split('T')[0];

    const [standingsData, roster, schedule] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/standings/${today}`),
      fetchJsonWithRetry(`${NHL_API_BASE}/roster/BUF/current`),
      fetchJsonWithRetry(`${NHL_API_BASE}/club-schedule-season/BUF/20252026`)
    ]);

    const sabres = standingsData.standings?.find(t => t.teamAbbrev?.default === 'BUF');

    // Get completed games
    const completedGames = (schedule.games || [])
      .filter(g => g.gameType === 2 && (g.gameState === 'FINAL' || g.gameState === 'OFF'));

    // Build roster list
    const rosterNames = [];
    if (roster.forwards) {
      roster.forwards.forEach(p => rosterNames.push(`${p.firstName?.default} ${p.lastName?.default}`));
    }
    if (roster.defensemen) {
      roster.defensemen.forEach(p => rosterNames.push(`${p.firstName?.default} ${p.lastName?.default}`));
    }
    if (roster.goalies) {
      roster.goalies.forEach(p => rosterNames.push(`${p.firstName?.default} ${p.lastName?.default}`));
    }

    return {
      team: 'sabres',
      record: sabres ? `${sabres.wins}-${sabres.losses}-${sabres.otLosses}` : 'N/A',
      points: sabres?.points || 'N/A',
      gamesPlayed: sabres?.gamesPlayed || 0,
      divisionRank: sabres?.divisionSequence || 'N/A',
      conferenceRank: sabres?.conferenceSequence || 'N/A',
      roster: rosterNames,
      recentGames: completedGames.slice(-10).map(g => ({
        gameId: g.id,
        date: g.gameDate,
        homeTeam: g.homeTeam?.abbrev,
        awayTeam: g.awayTeam?.abbrev,
        homeScore: g.homeTeam?.score,
        awayScore: g.awayTeam?.score
      }))
    };
  } catch (error) {
    console.error('Failed to fetch Sabres data for fact check:', error);
    return null;
  }
}

// Fetch Bills data for fact checking
async function fetchBillsData() {
  try {
    const [standingsData, rosterData] = await Promise.all([
      fetchJsonWithRetry(`${ESPN_API_BASE}/standings`),
      fetchJsonWithRetry(`${ESPN_API_BASE}/teams/2/roster`)
    ]);

    // Find Bills in standings
    let billsRecord = 'N/A';
    let divisionPosition = 'N/A';

    const afcConf = standingsData.children?.find(conf => conf.abbreviation === 'AFC');
    const afcEast = afcConf?.children?.find(div => div.name === 'AFC East');
    const billsEntry = afcEast?.standings?.entries?.find(
      entry => entry.team?.abbreviation === 'BUF'
    );

    if (billsEntry) {
      const overallStat = billsEntry.stats?.find(s => s.name === 'overall');
      billsRecord = overallStat?.displayValue || 'N/A';
      const position = afcEast?.standings?.entries?.findIndex(
        e => e.team?.abbreviation === 'BUF'
      );
      if (position !== -1) {
        divisionPosition = `${position + 1}${['st', 'nd', 'rd', 'th'][position] || 'th'} in AFC East`;
      }
    }

    // Build roster list
    const rosterNames = [];
    rosterData.athletes?.forEach(group => {
      group.items?.forEach(player => {
        rosterNames.push(player.fullName);
      });
    });

    return {
      team: 'bills',
      record: billsRecord,
      divisionPosition,
      roster: rosterNames
    };
  } catch (error) {
    console.error('Failed to fetch Bills data for fact check:', error);
    return null;
  }
}

// Fetch specific game data for game recaps
async function fetchGameData(gameId) {
  try {
    const [boxscore, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);

    if (!boxscore?.homeTeam || !boxscore?.awayTeam) {
      return null;
    }

    const isHomeTeamSabres = boxscore.homeTeam?.abbrev === 'BUF';
    const sabresTeam = isHomeTeamSabres ? boxscore.homeTeam : boxscore.awayTeam;
    const opponentTeam = isHomeTeamSabres ? boxscore.awayTeam : boxscore.homeTeam;

    return {
      gameId,
      date: landing?.gameDate || boxscore.gameDate,
      sabresScore: sabresTeam?.score || 0,
      opponentScore: opponentTeam?.score || 0,
      opponent: opponentTeam?.name?.default || opponentTeam?.abbrev,
      sabresShots: sabresTeam?.sog || 0,
      opponentShots: opponentTeam?.sog || 0,
      isHome: isHomeTeamSabres
    };
  } catch (error) {
    console.error(`Failed to fetch game data for ${gameId}:`, error);
    return null;
  }
}

// Format verified data for the AI prompt
function formatVerifiedData(teamData, gameData = null) {
  let dataBlock = `
═══════════════════════════════════════════════════════
VERIFIED DATA FOR FACT CHECKING
Source: Official ${teamData.team === 'sabres' ? 'NHL' : 'ESPN'} API
═══════════════════════════════════════════════════════

TEAM: ${teamData.team.toUpperCase()}
RECORD: ${teamData.record}
${teamData.points ? `POINTS: ${teamData.points}` : ''}
${teamData.divisionRank ? `DIVISION RANK: ${teamData.divisionRank}` : ''}
${teamData.divisionPosition ? `DIVISION: ${teamData.divisionPosition}` : ''}

CURRENT ROSTER (${teamData.roster.length} players):
${teamData.roster.join(', ')}
`;

  if (gameData) {
    dataBlock += `
GAME DATA (Game ID: ${gameData.gameId}):
- Date: ${gameData.date}
- Score: Sabres ${gameData.sabresScore} - ${gameData.opponent} ${gameData.opponentScore}
- Location: ${gameData.isHome ? 'Home' : 'Away'}
- Shots: Sabres ${gameData.sabresShots} - ${gameData.opponent} ${gameData.opponentShots}
`;
  }

  if (teamData.recentGames?.length > 0) {
    dataBlock += `
RECENT GAMES:
${teamData.recentGames.map(g => {
  const isHome = g.homeTeam === 'BUF';
  const sabresScore = isHome ? g.homeScore : g.awayScore;
  const oppScore = isHome ? g.awayScore : g.homeScore;
  const opp = isHome ? g.awayTeam : g.homeTeam;
  return `- ${g.date}: BUF ${sabresScore} - ${opp} ${oppScore}`;
}).join('\n')}
`;
  }

  dataBlock += `
═══════════════════════════════════════════════════════
`;

  return dataBlock;
}

// System prompt for fact checking
const FACT_CHECK_SYSTEM_PROMPT = `You are a fact-checking assistant for a sports blog. Your job is to analyze article content and identify potential factual issues.

Given an article and verified data from official APIs, you must:

1. VERIFY each factual claim in the article against the provided data
2. IDENTIFY any potential issues:
   - Player names not on the current roster
   - Incorrect scores or statistics
   - Wrong record or standings information
   - Dates that don't match
   - Made-up quotes (flag any quotes as unverifiable unless from web search)
   - Statistics that can't be verified

3. CATEGORIZE findings as:
   - "verified": Facts that match the official data exactly
   - "issue": Facts that contradict the official data (include what's wrong and what's correct)
   - "unverifiable": Facts that cannot be confirmed from the provided data (not necessarily wrong, just can't verify)
   - "warning": Potential concerns or things to double-check

4. For each finding, provide:
   - The specific claim from the article
   - The category (verified/issue/unverifiable/warning)
   - Explanation of why
   - If an issue: what the correct information is

Respond in JSON format:
{
  "summary": "Brief overall assessment",
  "issueCount": number,
  "warningCount": number,
  "findings": [
    {
      "claim": "The specific text from the article",
      "category": "verified|issue|unverifiable|warning",
      "explanation": "Why this is categorized this way",
      "correction": "The correct information (only for issues)"
    }
  ]
}

Focus on:
- Player names (check against roster)
- Scores and game results
- Statistics (goals, assists, saves, etc.)
- Record and standings
- Dates and opponents

Do NOT flag:
- Writing style or tone
- Opinions or analysis (unless stated as fact)
- General sports knowledge that's commonly known`;

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

  const { content, team, type, gameId } = req.body;

  // Validate required fields
  if (!content || !team) {
    return res.status(400).json({
      error: 'Missing required fields: content and team are required'
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  // Check for API key
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'AI service not configured',
      details: 'ANTHROPIC_API_KEY environment variable is not set'
    });
  }

  try {
    // Fetch verified data based on team
    let teamData;
    let gameData = null;

    if (team === 'sabres') {
      teamData = await fetchSabresData();
      if (gameId && type === 'game-recap') {
        gameData = await fetchGameData(gameId);
      }
    } else {
      teamData = await fetchBillsData();
    }

    if (!teamData) {
      return res.status(500).json({
        error: 'Failed to fetch team data for fact checking',
        details: 'Could not retrieve data from official APIs'
      });
    }

    const verifiedDataBlock = formatVerifiedData(teamData, gameData);

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    // Use Claude to analyze the content
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: FACT_CHECK_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Please fact-check the following article against the verified data provided.

${verifiedDataBlock}

ARTICLE TO CHECK:
---
${content}
---

Analyze the article and return your findings in JSON format.`
      }]
    });

    // Extract the response
    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    // Parse the JSON response
    let findings;
    try {
      // Extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        findings = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse fact-check response:', parseError);
      return res.status(500).json({
        error: 'Failed to parse fact-check results',
        details: parseError.message,
        rawResponse: responseText
      });
    }

    return res.status(200).json({
      success: true,
      ...findings,
      verifiedDataSummary: {
        team: teamData.team,
        record: teamData.record,
        rosterCount: teamData.roster.length,
        hasGameData: !!gameData
      }
    });

  } catch (error) {
    console.error('Fact check error:', error);
    return res.status(500).json({
      error: 'Failed to perform fact check',
      details: error.message
    });
  }
}
