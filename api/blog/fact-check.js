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

// Helper to find player name by ID (same as game-recap.js)
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

// Fetch FULL game box score data - SAME as game-recap.js
async function fetchFullGameBoxScore(gameId) {
  try {
    const [boxscore, playByPlay, landing] = await Promise.all([
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/boxscore`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/play-by-play`),
      fetchJsonWithRetry(`${NHL_API_BASE}/gamecenter/${gameId}/landing`)
    ]);

    if (!boxscore?.homeTeam || !boxscore?.awayTeam) {
      console.error(`Incomplete box score data for game ${gameId}`);
      return null;
    }

    return { boxscore, playByPlay, landing };
  } catch (error) {
    console.error(`Failed to fetch box score for game ${gameId}:`, error);
    return null;
  }
}

// Format box score data - SAME format as game-recap.js uses
function formatGameBoxScore(boxscore, playByPlay, landing) {
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

  // Extract goals from play-by-play - FULL SCORING SUMMARY
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

  // Three stars
  let threeStars = '';
  if (landing?.summary?.threeStars?.length > 0) {
    landing.summary.threeStars.forEach((star, idx) => {
      const starNum = idx + 1;
      threeStars += `${starNum}. ${star.name?.default || 'Unknown'} (${star.teamAbbrev?.default || '?'})\n`;
    });
  }

  return {
    formattedDate,
    sabresScore,
    opponentScore,
    opponentName: opponentTeam?.name?.default || opponentTeam?.abbrev,
    opponentAbbrev: opponentTeam?.abbrev,
    result,
    resultSuffix,
    isHome: isHomeTeamSabres,
    periodScores,
    sabresShots,
    opponentShots,
    scoringSummary,
    goalieStats,
    powerPlayStats,
    threeStars
  };
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

    // Build roster list with full names
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

// Format verified data for basic team info
function formatTeamData(teamData) {
  let dataBlock = `
TEAM: ${teamData.team.toUpperCase()}
RECORD: ${teamData.record}
${teamData.points ? `POINTS: ${teamData.points}` : ''}
${teamData.divisionRank ? `DIVISION RANK: ${teamData.divisionRank}` : ''}
${teamData.divisionPosition ? `DIVISION: ${teamData.divisionPosition}` : ''}

CURRENT ROSTER (${teamData.roster.length} players):
${teamData.roster.join(', ')}
`;

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

  return dataBlock;
}

// Format FULL game data for game-recap fact checking
function formatFullGameData(gameData) {
  return `
GAME DATA (${gameData.formattedDate}):
═══════════════════════════════════════════════════════

FINAL SCORE: Sabres ${gameData.sabresScore} - ${gameData.opponentAbbrev} ${gameData.opponentScore}
Result: ${gameData.result}${gameData.resultSuffix}
Location: ${gameData.isHome ? 'Home' : 'Away'}
Opponent: ${gameData.opponentName}

PERIOD BREAKDOWN:
${gameData.periodScores || 'Not available'}

SHOTS ON GOAL:
- Sabres: ${gameData.sabresShots}
- ${gameData.opponentAbbrev}: ${gameData.opponentShots}

SCORING SUMMARY (every goal with scorer and assists):
${gameData.scoringSummary || 'No goals scored'}

GOALTENDING:
${gameData.goalieStats || 'Not available'}

POWER PLAY:
${gameData.powerPlayStats || 'Not available'}

${gameData.threeStars ? `THREE STARS:\n${gameData.threeStars}` : ''}
═══════════════════════════════════════════════════════
`;
}

// System prompt for fact checking - CONSERVATIVE and PRECISE
const FACT_CHECK_SYSTEM_PROMPT = `You are a fact-checking assistant for a sports blog. Your job is to compare article content against VERIFIED DATA and identify ONLY clear factual errors.

IMPORTANT RULES:
1. Only flag something as an "issue" if there is a DIRECT NUMERICAL CONTRADICTION with the verified data
2. If the article mentions a player, goal, assist, or stat - verify it EXACTLY against the SCORING SUMMARY and GOALTENDING sections
3. If a claim cannot be verified from the provided data, mark it as "unverifiable" - this is NOT an error
4. Do NOT flag opinions, analysis, or narrative descriptions
5. Do NOT flag writing style or tone
6. Be CONSERVATIVE - when in doubt, mark as "unverifiable" not "issue"

WHAT TO CHECK:
- Final score (must match exactly)
- Goal scorers (must appear in SCORING SUMMARY)
- Assists (must match the assists listed for each goal)
- Goalie stats (saves, shots against, save %)
- Player names (must be on the roster OR in the game data)
- Period scores (if mentioned)
- Shot totals (if mentioned)
- Power play results (if mentioned)

WHAT NOT TO FLAG:
- General commentary or analysis
- Descriptions of momentum or gameplay
- Forward-looking statements
- Historical context not in the data
- Subjective assessments

CATEGORY DEFINITIONS:
- "verified": The claim EXACTLY matches the verified data
- "issue": The claim DIRECTLY CONTRADICTS the verified data (specify what's wrong vs what's correct)
- "unverifiable": Cannot confirm from available data (NOT an error)
- "warning": Minor concern but not a clear error

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
      "correction": "The correct information (ONLY for issues)"
    }
  ]
}

CRITICAL: Only include findings for verifiable factual claims. Skip narrative text, opinions, and analysis.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { content, team, type, gameId } = req.body;

  if (!content || !team) {
    return res.status(400).json({
      error: 'Missing required fields: content and team are required'
    });
  }

  if (!['sabres', 'bills'].includes(team)) {
    return res.status(400).json({ error: 'Invalid team. Must be sabres or bills' });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({
      error: 'AI service not configured',
      details: 'ANTHROPIC_API_KEY environment variable is not set'
    });
  }

  try {
    let teamData;
    let fullGameData = null;
    let verifiedDataBlock = '';

    if (team === 'sabres') {
      teamData = await fetchSabresData();

      // For game-recap articles, fetch FULL game data (same as generator)
      if (type === 'game-recap' && gameId) {
        const boxData = await fetchFullGameBoxScore(gameId);
        if (boxData) {
          fullGameData = formatGameBoxScore(boxData.boxscore, boxData.playByPlay, boxData.landing);
        }
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

    // Build the verified data block based on article type
    verifiedDataBlock = `
═══════════════════════════════════════════════════════
VERIFIED DATA FOR FACT CHECKING
Source: Official ${teamData.team === 'sabres' ? 'NHL' : 'ESPN'} API
Fetched: ${new Date().toISOString()}
═══════════════════════════════════════════════════════

${formatTeamData(teamData)}
`;

    // Add full game data if available (for game-recaps)
    if (fullGameData) {
      verifiedDataBlock += formatFullGameData(fullGameData);
    }

    verifiedDataBlock += `
═══════════════════════════════════════════════════════
INSTRUCTIONS FOR FACT CHECKER:
- Compare the article ONLY against the data above
- Every goal scorer/assist mentioned MUST appear in SCORING SUMMARY
- Every stat must match the numbers above exactly
- If something cannot be verified from this data, mark as "unverifiable"
═══════════════════════════════════════════════════════
`;

    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

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

Analyze the article and return your findings in JSON format. Focus ONLY on verifiable factual claims.`
      }]
    });

    const responseText = message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n');

    let findings;
    try {
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
        hasGameData: !!fullGameData,
        gameDataDetails: fullGameData ? {
          opponent: fullGameData.opponentName,
          score: `${fullGameData.sabresScore}-${fullGameData.opponentScore}`,
          result: fullGameData.result
        } : null
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
