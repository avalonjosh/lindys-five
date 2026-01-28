import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '../blog/settings.js';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const BILLS_TEAM_ID = 2; // Buffalo Bills ESPN team ID

// Game recap system prompt
const GAME_RECAP_SYSTEM_PROMPT = `You are a professional sports journalist writing a game recap for "Lindy's Five", a Buffalo Bills fan blog.

Your task is to write an engaging, narrative game recap based ONLY on the verified box score data provided. Do NOT use web search - all the facts you need are in the data.

Writing style:
- Professional sports journalism tone - authoritative yet accessible
- Lead with the outcome and final score
- Highlight key moments: touchdowns, turnovers, momentum swings
- Feature standout individual performances using the stats provided
- Build a narrative arc: how did the game unfold quarter by quarter?
- End with forward-looking perspective or context

Structure:
- Opening paragraph: Result, score, key takeaway
- Game flow: Quarter-by-quarter narrative with specific plays
- Standout performances: Players who made a difference (Josh Allen, key receivers, defensive standouts)
- Special teams: Field goals, punt returns, kickoff returns
- Closing: What this means for playoff picture or season outlook

Format guidelines:
- Write in Markdown format
- Use ## headers for major sections
- Use **bold** for player names and key stats
- Keep paragraphs concise (3-4 sentences max)
- Article should be 400-600 words

CRITICAL: Use ONLY the data provided in the VERIFIED GAME DATA block. Do not invent any statistics, player names, or game details not explicitly listed.`;

// Fetch Bills schedule
async function fetchBillsSchedule() {
  try {
    const res = await fetch(`${ESPN_API_BASE}/teams/buf/schedule`);
    const data = await res.json();
    return data.events || [];
  } catch (error) {
    console.error('Failed to fetch Bills schedule:', error);
    return [];
  }
}

// Fetch game summary (box score) from ESPN
async function fetchGameSummary(gameId) {
  try {
    const res = await fetch(`${ESPN_API_BASE}/summary?event=${gameId}`);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error(`Failed to fetch game summary for ${gameId}:`, error);
    return null;
  }
}

// Extract passing stats from boxscore
function extractPassingStats(players, teamId) {
  const teamPlayers = players?.find(p => p.team?.id === String(teamId));
  const passing = teamPlayers?.statistics?.find(s => s.name === 'passing');
  if (!passing?.athletes?.length) return [];

  return passing.athletes.map(a => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
    // ESPN stats order: C/ATT, YDS, AVG, TD, INT, SACKS, QBR, RTG
  }));
}

// Extract rushing stats from boxscore
function extractRushingStats(players, teamId) {
  const teamPlayers = players?.find(p => p.team?.id === String(teamId));
  const rushing = teamPlayers?.statistics?.find(s => s.name === 'rushing');
  if (!rushing?.athletes?.length) return [];

  return rushing.athletes.slice(0, 3).map(a => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
    // ESPN stats order: CAR, YDS, AVG, TD, LONG
  }));
}

// Extract receiving stats from boxscore
function extractReceivingStats(players, teamId) {
  const teamPlayers = players?.find(p => p.team?.id === String(teamId));
  const receiving = teamPlayers?.statistics?.find(s => s.name === 'receiving');
  if (!receiving?.athletes?.length) return [];

  return receiving.athletes.slice(0, 4).map(a => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
    // ESPN stats order: REC, YDS, AVG, TD, LONG, TGTS
  }));
}

// Extract defensive stats from boxscore
function extractDefensiveStats(players, teamId) {
  const teamPlayers = players?.find(p => p.team?.id === String(teamId));
  const defense = teamPlayers?.statistics?.find(s => s.name === 'defensive');
  if (!defense?.athletes?.length) return [];

  return defense.athletes.slice(0, 3).map(a => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
    // ESPN stats order: TOT, SOLO, SACKS, TFL, PD, QB HTS, TD
  }));
}

// Format box score data into context block
function formatBoxScore(summary, billsTeamId) {
  if (!summary || !summary.boxscore) {
    return 'Box score data not available.';
  }

  const { boxscore, scoringPlays, header, leaders } = summary;
  const competition = header?.competitions?.[0];

  // Determine which team is Bills
  const competitors = competition?.competitors || [];
  const billsTeam = competitors.find(c => c.team?.id === String(billsTeamId) || c.team?.abbreviation === 'BUF');
  const oppTeam = competitors.find(c => c.team?.id !== String(billsTeamId) && c.team?.abbreviation !== 'BUF');

  if (!billsTeam || !oppTeam) {
    return 'Unable to identify teams in game data.';
  }

  const billsScore = parseInt(billsTeam.score) || 0;
  const oppScore = parseInt(oppTeam.score) || 0;
  const isWin = billsScore > oppScore;
  const isHome = billsTeam.homeAway === 'home';
  const oppName = oppTeam.team?.displayName || oppTeam.team?.abbreviation || 'Opponent';
  const oppAbbrev = oppTeam.team?.abbreviation || 'OPP';

  // Game date
  const gameDate = header?.competitions?.[0]?.date || 'Unknown Date';
  const formattedDate = new Date(gameDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Quarter scores
  const billsLinescores = billsTeam.linescores || [];
  const oppLinescores = oppTeam.linescores || [];
  let quarterScores = '';
  for (let i = 0; i < Math.max(billsLinescores.length, oppLinescores.length); i++) {
    const qName = i < 4 ? `Q${i + 1}` : `OT${i - 3}`;
    const billsQ = billsLinescores[i]?.value || 0;
    const oppQ = oppLinescores[i]?.value || 0;
    quarterScores += `${qName}: Bills ${billsQ} - ${oppAbbrev} ${oppQ}\n`;
  }

  // Team stats
  const teamStats = boxscore?.teams || [];
  const billsStats = teamStats.find(t => t.team?.id === String(billsTeamId) || t.team?.abbreviation === 'BUF');
  const oppStats = teamStats.find(t => t.team?.id !== String(billsTeamId) && t.team?.abbreviation !== 'BUF');

  // Extract key team stats
  function getStatValue(stats, name) {
    const stat = stats?.statistics?.find(s => s.name === name);
    return stat?.displayValue || 'N/A';
  }

  const billsTotalYards = getStatValue(billsStats, 'totalYards');
  const oppTotalYards = getStatValue(oppStats, 'totalYards');
  const billsPassYards = getStatValue(billsStats, 'netPassingYards');
  const oppPassYards = getStatValue(oppStats, 'netPassingYards');
  const billsRushYards = getStatValue(billsStats, 'rushingYards');
  const oppRushYards = getStatValue(oppStats, 'rushingYards');
  const billsTOP = getStatValue(billsStats, 'possessionTime');
  const oppTOP = getStatValue(oppStats, 'possessionTime');
  const billsTurnovers = getStatValue(billsStats, 'turnovers');
  const oppTurnovers = getStatValue(oppStats, 'turnovers');

  // Player stats
  const players = boxscore?.players || [];
  const billsPassing = extractPassingStats(players, billsTeamId);
  const billsRushing = extractRushingStats(players, billsTeamId);
  const billsReceiving = extractReceivingStats(players, billsTeamId);
  const billsDefense = extractDefensiveStats(players, billsTeamId);

  // Scoring plays
  let scoringSummary = '';
  if (scoringPlays?.length) {
    scoringPlays.forEach(play => {
      const qtr = play.period?.number || '?';
      const time = play.clock?.displayValue || '??:??';
      const team = play.team?.abbreviation || '?';
      const text = play.text || 'Score';
      const score = play.awayScore && play.homeScore
        ? `(${isHome ? play.homeScore : play.awayScore}-${isHome ? play.awayScore : play.homeScore})`
        : '';
      scoringSummary += `- Q${qtr} ${time}: ${team} - ${text} ${score}\n`;
    });
  }

  return `
═══════════════════════════════════════════════════════
VERIFIED GAME DATA - ${formattedDate}
Buffalo Bills vs ${oppName}
Source: ESPN API Box Score
═══════════════════════════════════════════════════════

FINAL SCORE: Bills ${billsScore} - ${oppAbbrev} ${oppScore}
Result: ${isWin ? 'WIN' : 'LOSS'}
Location: ${isHome ? 'Home (Highmark Stadium)' : 'Away'}

QUARTER BREAKDOWN:
${quarterScores || 'Not available'}

TEAM STATS:
             Bills     ${oppAbbrev}
Total Yards: ${billsTotalYards}    ${oppTotalYards}
Pass Yards:  ${billsPassYards}    ${oppPassYards}
Rush Yards:  ${billsRushYards}    ${oppRushYards}
Time of Poss: ${billsTOP}  ${oppTOP}
Turnovers:   ${billsTurnovers}       ${oppTurnovers}

BILLS PASSING:
${billsPassing.length ? billsPassing.map(p => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS RUSHING:
${billsRushing.length ? billsRushing.map(p => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS RECEIVING:
${billsReceiving.length ? billsReceiving.map(p => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS DEFENSIVE LEADERS:
${billsDefense.length ? billsDefense.map(p => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

SCORING SUMMARY:
${scoringSummary || 'No scoring plays recorded'}

═══════════════════════════════════════════════════════
STRICT INSTRUCTIONS:
- Write a NARRATIVE game recap using ONLY the data above
- DO NOT search the web - all facts are provided
- DO NOT invent any statistics not listed here
- Reference specific players, scores, and moments from the data
═══════════════════════════════════════════════════════
`;
}

// Generate dynamic title based on game result
function generateTitle(isWin, billsScore, oppScore, opponent) {
  const margin = Math.abs(billsScore - oppScore);

  const winVerbs = ['Defeat', 'Top', 'Down', 'Beat', 'Edge'];
  const blowoutVerbs = ['Dominate', 'Rout', 'Crush'];

  if (isWin) {
    if (margin >= 14) {
      const verb = blowoutVerbs[Math.floor(Math.random() * blowoutVerbs.length)];
      return `Bills ${verb} ${opponent} ${billsScore}-${oppScore}`;
    } else if (margin <= 3) {
      return `Bills Edge ${opponent} ${billsScore}-${oppScore}`;
    } else {
      const verb = winVerbs[Math.floor(Math.random() * winVerbs.length)];
      return `Bills ${verb} ${opponent} ${billsScore}-${oppScore}`;
    }
  } else {
    if (margin >= 14) {
      return `${opponent} Overwhelm Bills ${oppScore}-${billsScore}`;
    } else if (margin <= 3) {
      return `Bills Fall Short Against ${opponent} ${oppScore}-${billsScore}`;
    } else {
      return `Bills Lose to ${opponent} ${oppScore}-${billsScore}`;
    }
  }
}

// Create post in KV
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
    team: 'bills',
    type: 'game-recap',
    status: postData.status,
    createdAt: now,
    publishedAt: postData.status === 'published' ? now : null,
    updatedAt: now,
    gameId: postData.gameId,
    opponent: postData.opponent,
    gameDate: postData.gameDate,
    aiGenerated: true,
    aiModel: 'claude-sonnet-4-20250514',
    metaDescription: postData.metaDescription
  };

  await kv.set(`blog:post:${id}`, post);

  const score = post.publishedAt
    ? new Date(post.publishedAt).getTime()
    : new Date(now).getTime();
  await kv.zadd('blog:posts', { score, member: id });
  await kv.zadd('blog:posts:bills', { score, member: id });
  await kv.zadd('blog:posts:type:game-recap', { score, member: id });
  await kv.set(`blog:slug:${slug}`, id);

  return post;
}

// Check if game has been processed
async function hasGameBeenProcessed(gameId) {
  return await kv.sismember('blog:bills-gamerecap:processed', String(gameId));
}

// Mark game as processed
async function markGameProcessed(gameId, postId, metadata) {
  await kv.sadd('blog:bills-gamerecap:processed', String(gameId));
  await kv.set(`blog:bills-gamerecap:log:${gameId}`, {
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
    // Fetch Bills schedule
    const events = await fetchBillsSchedule();

    // Find completed games in the last 48 hours
    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const completedGames = events.filter(event => {
      const status = event.competitions?.[0]?.status?.type?.completed;
      const gameDate = new Date(event.date);
      return status === true && gameDate >= cutoff;
    });

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
        message: 'No new Bills games to process',
        gamesFound: completedGames.length,
        gamesProcessed: 0
      });
    }

    // Process each unprocessed game
    const results = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('bills-game-recap');

    for (const game of unprocessedGames) {
      try {
        // Fetch game summary
        const summary = await fetchGameSummary(game.id);
        if (!summary) {
          results.push({ gameId: game.id, error: 'Failed to fetch game summary' });
          continue;
        }

        // Format context
        const verifiedGameData = formatBoxScore(summary, BILLS_TEAM_ID);

        // Determine game details from summary
        const competition = summary.header?.competitions?.[0];
        const competitors = competition?.competitors || [];
        const billsTeam = competitors.find(c => c.team?.abbreviation === 'BUF');
        const oppTeam = competitors.find(c => c.team?.abbreviation !== 'BUF');

        const billsScore = parseInt(billsTeam?.score) || 0;
        const oppScore = parseInt(oppTeam?.score) || 0;
        const opponent = oppTeam?.team?.displayName || 'Opponent';
        const oppAbbrev = oppTeam?.team?.abbreviation || 'OPP';
        const isWin = billsScore > oppScore;
        const gameDate = game.date;

        // Generate article
        const message = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system: GAME_RECAP_SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `Write a game recap for the Buffalo Bills based on the following verified box score data:\n\n${verifiedGameData}\n\nThe article should be 400-600 words.`
          }]
        });

        const content = message.content
          .filter(block => block.type === 'text')
          .map(block => block.text)
          .join('\n');

        // Generate title
        const title = generateTitle(isWin, billsScore, oppScore, opponent);

        // Generate meta description
        const metaDescription = `Game recap: Buffalo Bills ${isWin ? 'defeat' : 'fall to'} ${opponent} ${billsScore}-${oppScore}. Full breakdown and analysis.`;

        // Create post
        const post = await createPost({
          title,
          content,
          status: autoPublish ? 'published' : 'draft',
          gameId: game.id,
          opponent: oppAbbrev,
          gameDate,
          metaDescription
        });

        // Mark as processed
        await markGameProcessed(game.id, post.id, {
          opponent: oppAbbrev,
          gameDate,
          result: `${billsScore}-${oppScore}`
        });

        results.push({
          gameId: game.id,
          postId: post.id,
          postSlug: post.slug,
          status: post.status,
          title: post.title,
          opponent: oppAbbrev,
          result: `${isWin ? 'W' : 'L'} ${billsScore}-${oppScore}`
        });

      } catch (error) {
        console.error(`Error processing Bills game ${game.id}:`, error);
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
    console.error('Bills game recap cron error:', error);
    return res.status(500).json({
      error: 'Failed to process Bills game recaps',
      message: error.message
    });
  }
}
