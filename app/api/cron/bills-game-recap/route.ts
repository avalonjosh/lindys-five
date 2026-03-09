import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';
import Anthropic from '@anthropic-ai/sdk';
import { getAutoPublishSetting } from '@/app/api/blog/settings/route';
import { fetchJsonWithRetry, truncateAtWordBoundary } from '@/lib/fetchWithRetry';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
const BILLS_TEAM_ID = 2; // Buffalo Bills ESPN team ID

// Minimum time (in ms) after game ends before processing
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _GAME_END_BUFFER_MS = 30 * 60 * 1000; // 30 minutes

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

async function fetchBillsSchedule() {
  try {
    const data = await fetchJsonWithRetry(`${ESPN_API_BASE}/teams/buf/schedule`);
    return data.events || [];
  } catch (error) {
    console.error('Failed to fetch Bills schedule after retries:', error);
    return [];
  }
}

async function fetchGameSummary(gameId: string) {
  try {
    const data = await fetchJsonWithRetry(`${ESPN_API_BASE}/summary?event=${gameId}`);
    return data;
  } catch (error) {
    console.error(`Failed to fetch game summary for ${gameId} after retries:`, error);
    return null;
  }
}

function extractPassingStats(players: any[], teamId: number) {
  const teamPlayers = players?.find((p: any) => p.team?.id === String(teamId));
  const passing = teamPlayers?.statistics?.find((s: any) => s.name === 'passing');
  if (!passing?.athletes?.length) return [];

  return passing.athletes.map((a: any) => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
  }));
}

function extractRushingStats(players: any[], teamId: number) {
  const teamPlayers = players?.find((p: any) => p.team?.id === String(teamId));
  const rushing = teamPlayers?.statistics?.find((s: any) => s.name === 'rushing');
  if (!rushing?.athletes?.length) return [];

  return rushing.athletes.slice(0, 3).map((a: any) => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
  }));
}

function extractReceivingStats(players: any[], teamId: number) {
  const teamPlayers = players?.find((p: any) => p.team?.id === String(teamId));
  const receiving = teamPlayers?.statistics?.find((s: any) => s.name === 'receiving');
  if (!receiving?.athletes?.length) return [];

  return receiving.athletes.slice(0, 4).map((a: any) => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
  }));
}

function extractDefensiveStats(players: any[], teamId: number) {
  const teamPlayers = players?.find((p: any) => p.team?.id === String(teamId));
  const defense = teamPlayers?.statistics?.find((s: any) => s.name === 'defensive');
  if (!defense?.athletes?.length) return [];

  return defense.athletes.slice(0, 3).map((a: any) => ({
    name: a.athlete?.displayName || 'Unknown',
    stats: a.stats?.join(', ') || 'N/A',
  }));
}

function formatBoxScore(summary: any, billsTeamId: number) {
  if (!summary || !summary.boxscore) {
    return 'Box score data not available.';
  }

  const { boxscore, scoringPlays, header } = summary;
  const competition = header?.competitions?.[0];

  const competitors = competition?.competitors || [];
  const billsTeam = competitors.find((c: any) => c.team?.id === String(billsTeamId) || c.team?.abbreviation === 'BUF');
  const oppTeam = competitors.find((c: any) => c.team?.id !== String(billsTeamId) && c.team?.abbreviation !== 'BUF');

  if (!billsTeam || !oppTeam) {
    return 'Unable to identify teams in game data.';
  }

  const billsScore = parseInt(billsTeam.score) || 0;
  const oppScore = parseInt(oppTeam.score) || 0;
  const isWin = billsScore > oppScore;
  const isHome = billsTeam.homeAway === 'home';
  const oppName = oppTeam.team?.displayName || oppTeam.team?.abbreviation || 'Opponent';
  const oppAbbrev = oppTeam.team?.abbreviation || 'OPP';

  const gameDate = header?.competitions?.[0]?.date || 'Unknown Date';
  const formattedDate = new Date(gameDate).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  const billsLinescores = billsTeam.linescores || [];
  const oppLinescores = oppTeam.linescores || [];
  let quarterScores = '';
  for (let i = 0; i < Math.max(billsLinescores.length, oppLinescores.length); i++) {
    const qName = i < 4 ? `Q${i + 1}` : `OT${i - 3}`;
    const billsQ = billsLinescores[i]?.value || 0;
    const oppQ = oppLinescores[i]?.value || 0;
    quarterScores += `${qName}: Bills ${billsQ} - ${oppAbbrev} ${oppQ}\n`;
  }

  const teamStats = boxscore?.teams || [];
  const billsStats = teamStats.find((t: any) => t.team?.id === String(billsTeamId) || t.team?.abbreviation === 'BUF');
  const oppStats = teamStats.find((t: any) => t.team?.id !== String(billsTeamId) && t.team?.abbreviation !== 'BUF');

  function getStatValue(stats: any, name: string) {
    const stat = stats?.statistics?.find((s: any) => s.name === name);
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

  const players = boxscore?.players || [];
  const billsPassing = extractPassingStats(players, billsTeamId);
  const billsRushing = extractRushingStats(players, billsTeamId);
  const billsReceiving = extractReceivingStats(players, billsTeamId);
  const billsDefense = extractDefensiveStats(players, billsTeamId);

  let scoringSummary = '';
  if (scoringPlays?.length) {
    scoringPlays.forEach((play: any) => {
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
${billsPassing.length ? billsPassing.map((p: any) => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS RUSHING:
${billsRushing.length ? billsRushing.map((p: any) => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS RECEIVING:
${billsReceiving.length ? billsReceiving.map((p: any) => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

BILLS DEFENSIVE LEADERS:
${billsDefense.length ? billsDefense.map((p: any) => `- ${p.name}: ${p.stats}`).join('\n') : 'N/A'}

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

function generateTitle(isWin: boolean, billsScore: number, oppScore: number, opponent: string) {
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

async function createPost(postData: any) {
  const dateStr = new Date().toISOString().split('T')[0];
  const titleSlug = postData.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
  const slug = `${titleSlug}-${dateStr}`;

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

async function hasGameBeenProcessed(gameId: string) {
  return await kv.sismember('blog:bills-gamerecap:processed', String(gameId));
}

async function markGameProcessed(gameId: string, postId: string, metadata: any) {
  await kv.sadd('blog:bills-gamerecap:processed', String(gameId));
  await kv.set(`blog:bills-gamerecap:log:${gameId}`, {
    processedAt: new Date().toISOString(),
    postId,
    ...metadata
  });
}

export async function GET(request: NextRequest) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const events = await fetchBillsSchedule();

    const now = new Date();
    const cutoff = new Date(now.getTime() - 48 * 60 * 60 * 1000);

    const completedGames = events.filter((event: any) => {
      const status = event.competitions?.[0]?.status?.type?.completed;
      const gameDate = new Date(event.date);
      return status === true && gameDate >= cutoff;
    });

    const unprocessedGames: any[] = [];
    for (const game of completedGames) {
      if (!(await hasGameBeenProcessed(game.id))) {
        unprocessedGames.push(game);
      }
    }

    if (unprocessedGames.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No new Bills games to process',
        gamesFound: completedGames.length,
        gamesProcessed: 0
      });
    }

    const results: any[] = [];
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const autoPublish = await getAutoPublishSetting('bills-game-recap');

    for (const game of unprocessedGames) {
      try {
        const summary = await fetchGameSummary(game.id);
        if (!summary) {
          results.push({ gameId: game.id, error: 'Failed to fetch game summary' });
          continue;
        }

        const verifiedGameData = formatBoxScore(summary, BILLS_TEAM_ID);

        const competition = summary.header?.competitions?.[0];
        const competitors = competition?.competitors || [];
        const billsTeam = competitors.find((c: any) => c.team?.abbreviation === 'BUF');
        const oppTeam = competitors.find((c: any) => c.team?.abbreviation !== 'BUF');

        const billsScore = parseInt(billsTeam?.score) || 0;
        const oppScore = parseInt(oppTeam?.score) || 0;
        const opponent = oppTeam?.team?.displayName || 'Opponent';
        const oppAbbrev = oppTeam?.team?.abbreviation || 'OPP';
        const isWin = billsScore > oppScore;
        const gameDate = game.date;

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
          .filter((block: any) => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');

        const title = generateTitle(isWin, billsScore, oppScore, opponent);
        const metaDescription = `Game recap: Buffalo Bills ${isWin ? 'defeat' : 'fall to'} ${opponent} ${billsScore}-${oppScore}. Full breakdown and analysis.`;

        const post = await createPost({
          title,
          content,
          status: autoPublish ? 'published' : 'draft',
          gameId: game.id,
          opponent: oppAbbrev,
          gameDate,
          metaDescription
        });

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

      } catch (error: any) {
        console.error(`Error processing Bills game ${game.id}:`, error);
        results.push({ gameId: game.id, error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      gamesFound: completedGames.length,
      gamesProcessed: results.filter((r: any) => !r.error).length,
      results
    });

  } catch (error: any) {
    console.error('Bills game recap cron error:', error);
    return NextResponse.json({
      error: 'Failed to process Bills game recaps',
      message: error.message
    }, { status: 500 });
  }
}
