import { Resend } from 'resend';
import { kv } from '@vercel/kv';
import type { BlogPost, NewsletterSubscriber, EmailSendRecord, GameResult, GameChunk } from './types';
import type { LandingResponse, StandingsTeam, ScoringGoal, ThreeStar } from './types/boxscore';
import { TEAMS } from './teamConfig';
import { fetchJsonWithRetry } from './fetchWithRetry';
import { generateGameTicketLink } from './utils/affiliateLinks';
import { getProjectedPoints, getDivCutLine, getWcCutLine, isInPlayoffPosition, getPlayoffProbability } from './utils/standingsCalc';
import { computePositionAwareProbability } from './utils/playoffProbability';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) {
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';
const FROM_EMAIL = "Lindy's Five <noreply@lindysfive.com>";
const NHL_API = 'https://api-web.nhle.com/v1';

// ─── Verification Email ───────────────────────────────────────────

export async function sendVerificationEmail(email: string, token: string) {
  const verifyUrl = `${SITE_URL}/api/newsletter/verify?token=${token}`;

  await getResend().emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Confirm your Lindy's Five subscription",
    html: renderVerificationEmail(verifyUrl),
  });
}

function renderVerificationEmail(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">
        <tr><td style="background:#003087;padding:20px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;font-style:normal;">Lindy's Five</h1>
        </td></tr>
        <tr><td style="padding:24px 20px;">
          <h2 style="margin:0 0 16px;color:#1e293b;font-size:20px;">Confirm your subscription</h2>
          <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.6;">
            Thanks for signing up for game recaps and set recaps from Lindy's Five. Click below to confirm your email:
          </p>
          <a href="${verifyUrl}" style="display:inline-block;background:#003087;color:#ffffff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
            Confirm Email
          </a>
          <p style="margin:24px 0 0;color:#94a3b8;font-size:13px;line-height:1.5;">
            If you didn't sign up, you can ignore this email. This link expires in 24 hours.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Lindy's Five &mdash; NHL Playoff Odds &amp; Standings</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Game Recap Email (Blog-based, Sabres only) ──────────────────

export async function sendGameRecapNewsletter(post: BlogPost) {
  const subscribers = await getVerifiedSubscribersForTeam(post.team);
  if (subscribers.length === 0) return;

  // Try to send boxscore-style email with blog link
  try {
    await sendBoxscoreRecapForTeam(post.team, subscribers, post);
  } catch (error) {
    console.error('Failed to send boxscore recap, falling back to blog recap:', error);
    // Fallback: send simple blog recap
    const subject = post.title;
    const postUrl = `${SITE_URL}/blog/${post.team}/${post.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=game-recap&utm_content=blog-link`;
    const html = renderSimpleBlogRecap(post, postUrl);
    const sendId = await recordEmailSend(post.team, subscribers.length, subject);
    await sendBatchEmails(subscribers, subject, html, sendId);
  }
}

// ─── Set Recap Email ──────────────────────────────────────────────

export async function sendSetRecapNewsletter(post: BlogPost) {
  // Try data-driven set recap first, fall back to blog-based
  const subscribers = await getVerifiedSubscribersForTeam(post.team);
  if (subscribers.length === 0) return;

  try {
    await sendSetRecapForTeam(post.team, subscribers);
  } catch (error) {
    console.error('Failed to send data-driven set recap, falling back to blog:', error);
    const subject = post.title;
    const postUrl = `${SITE_URL}/blog/${post.team}/${post.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=set-recap&utm_content=blog-link`;
    const html = renderSimpleBlogRecap(post, postUrl);
    const sendId = await recordEmailSend(post.team, subscribers.length, subject);
    await sendBatchEmails(subscribers, subject, html, sendId);
  }
}

export async function sendSetRecapForTeam(
  teamSlug: string,
  subscribers: NewsletterSubscriber[]
) {
  const teamConfig = TEAMS[teamSlug];
  if (!teamConfig) throw new Error(`Unknown team: ${teamSlug}`);

  // Fetch schedule and compute chunks
  const schedule = await fetchTeamSchedule(teamConfig.abbreviation, teamConfig.nhlId);
  const chunks = computeChunksFromSchedule(schedule, teamConfig.nhlId);

  // Find the most recent completed set
  const completedChunks = chunks.filter((c) => c.isComplete);
  if (completedChunks.length === 0) throw new Error(`No completed sets for ${teamSlug}`);
  const latestSet = completedChunks[completedChunks.length - 1];

  // Fetch standings for playoff probability
  const standings = await fetchStandings();
  const teamStanding = standings.find(
    (t) => t.teamAbbrev?.default === teamConfig.abbreviation
  );

  const probAfter = teamStanding && standings.length > 0
    ? getPlayoffProbability(teamStanding, standings) : 50;

  // Season stats
  const seasonStats = teamStanding ? {
    gamesPlayed: teamStanding.gamesPlayed,
    points: teamStanding.points,
    pace: (teamStanding.points / teamStanding.gamesPlayed).toFixed(2),
    projected: getProjectedPoints(teamStanding.points, teamStanding.gamesPlayed),
    record: `${teamStanding.wins}-${teamStanding.losses}-${teamStanding.otLosses}`,
  } : { gamesPlayed: 0, points: 0, pace: '0.00', projected: 0, record: '0-0-0' };

  // Next game
  const nextGame = await fetchNextGame(teamConfig);

  // Date range for the set
  const completedGames = latestSet.games.filter((g) => g.outcome !== 'PENDING');
  const firstDate = completedGames[0]?.date;
  const lastDate = completedGames[completedGames.length - 1]?.date;
  const dateRange = formatSetDateRange(firstDate, lastDate);

  // Target met?
  const targetPoints = Math.ceil(latestSet.maxPoints * 0.6);
  const targetMet = latestSet.points >= targetPoints;

  const primaryColor = teamConfig.colors.primary;
  const trackerUrl = `${SITE_URL}/${teamSlug}?utm_source=newsletter&utm_medium=email&utm_campaign=set-recap&utm_content=tracker`;

  // Subject line
  const subject = `${teamConfig.name} Set ${latestSet.chunkNumber} Recap: ${latestSet.points} of ${latestSet.maxPoints} points (${latestSet.wins}W-${latestSet.otLosses}OTL-${latestSet.losses}L)`;

  const html = renderSetRecapEmail({
    teamConfig,
    set: latestSet,
    dateRange,
    targetPoints,
    targetMet,
    seasonStats,
    probAfter,
    primaryColor,
    trackerUrl,
    nextGame,
  });

  const sendId = await recordEmailSend(teamSlug, subscribers.length, subject);
  await sendBatchEmails(subscribers, subject, html, sendId);
}

// ─── Boxscore Recap Email ────────────────────────────────────────

interface GameRecapData {
  teamSlug: string;
  teamConfig: typeof TEAMS[string];
  landing: LandingResponse;
  standings: StandingsTeam[];
  nextGame: { opponent: string; date: string; time: string; ticketLink: string } | null;
  probBefore: number;
  probAfter: number;
  oppProbBefore: number;
  oppProbAfter: number;
  seasonStats: {
    gamesPlayed: number;
    points: number;
    pace: string;
    projected: number;
    record: string;
  };
}

async function sendBoxscoreRecapForTeam(
  teamSlug: string,
  subscribers: NewsletterSubscriber[],
  blogPost?: BlogPost
) {
  const teamConfig = TEAMS[teamSlug];
  if (!teamConfig) throw new Error(`Unknown team: ${teamSlug}`);

  // Fetch the most recent completed game for this team
  const landing = await fetchRecentGame(teamConfig.abbreviation);
  if (!landing) throw new Error(`No recent game found for ${teamSlug}`);

  // Fetch standings
  const standings = await fetchStandings();

  // Find this team in standings
  const teamStanding = standings.find(
    (t) => t.teamAbbrev?.default === teamConfig.abbreviation
  );

  // Determine game participants
  const isHome = landing.homeTeam.abbrev === teamConfig.abbreviation;
  const oppAbbrev = isHome ? landing.awayTeam.abbrev : landing.homeTeam.abbrev;
  const teamScore = isHome ? landing.homeTeam.score : landing.awayTeam.score;
  const oppScore = isHome ? landing.awayTeam.score : landing.homeTeam.score;
  const won = teamScore > oppScore;
  const isOT = landing.gameOutcome?.lastPeriodType === 'OT' || landing.gameOutcome?.lastPeriodType === 'SO';

  // Find opponent in standings
  const oppStanding = standings.find(
    (t) => t.teamAbbrev?.default === oppAbbrev
  );

  // Helper to calculate before/after probability for a team
  function calcProbChange(standing: StandingsTeam | undefined, teamWon: boolean, otGame: boolean) {
    if (!standing || standings.length === 0) return { before: 50, after: 50 };
    const after = getPlayoffProbability(standing, standings);
    let pointsBefore = standing.points;
    if (teamWon) pointsBefore -= 2;
    else if (otGame) pointsBefore -= 1;
    const gpBefore = standing.gamesPlayed - 1;
    if (gpBefore <= 0) return { before: 50, after };
    const projectedBefore = getProjectedPoints(pointsBefore, gpBefore);
    const divCutLine = getDivCutLine(standing, standings);
    const wcCutLine = getWcCutLine(standing, standings);
    const inPlayoffs = isInPlayoffPosition(standing);
    const before = computePositionAwareProbability(
      projectedBefore, gpBefore, divCutLine, wcCutLine, inPlayoffs
    ).probability;
    return { before, after };
  }

  const teamProb = calcProbChange(teamStanding, won, isOT);
  const oppProb = calcProbChange(oppStanding, !won, isOT);

  // Season stats
  const seasonStats = teamStanding ? {
    gamesPlayed: teamStanding.gamesPlayed,
    points: teamStanding.points,
    pace: (teamStanding.points / teamStanding.gamesPlayed).toFixed(2),
    projected: getProjectedPoints(teamStanding.points, teamStanding.gamesPlayed),
    record: `${teamStanding.wins}-${teamStanding.losses}-${teamStanding.otLosses}`,
  } : {
    gamesPlayed: 0, points: 0, pace: '0.00', projected: 0, record: '0-0-0',
  };

  // Fetch next game
  const nextGame = await fetchNextGame(teamConfig);

  const data: GameRecapData = {
    teamSlug,
    teamConfig,
    landing,
    standings,
    nextGame,
    probBefore: teamProb.before,
    probAfter: teamProb.after,
    oppProbBefore: oppProb.before,
    oppProbAfter: oppProb.after,
    seasonStats,
  };

  // Build subject line
  const suffix = landing.gameOutcome?.lastPeriodType === 'OT' ? ' (OT)'
    : landing.gameOutcome?.lastPeriodType === 'SO' ? ' (SO)' : '';
  const resultWord = won ? 'defeat' : 'fall to';
  const subject = `${teamConfig.name} ${resultWord} ${oppAbbrev} ${teamScore}-${oppScore}${suffix}`;

  const html = renderBoxscoreEmail(data, blogPost);

  const sendId = await recordEmailSend(teamSlug, subscribers.length, subject);
  await sendBatchEmails(subscribers, subject, html, sendId);
}

// ─── NHL API Fetchers ────────────────────────────────────────────

async function fetchRecentGame(teamAbbrev: string): Promise<LandingResponse | null> {
  try {
    // Get today's date and look back up to 3 days
    const now = new Date();
    for (let daysBack = 0; daysBack <= 3; daysBack++) {
      const date = new Date(now);
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0];

      const schedule = await fetchJsonWithRetry(
        `${NHL_API}/schedule/${dateStr}`
      );

      for (const gameWeek of schedule.gameWeek || []) {
        for (const game of gameWeek.games || []) {
          if (
            (game.homeTeam?.abbrev === teamAbbrev || game.awayTeam?.abbrev === teamAbbrev) &&
            (game.gameState === 'FINAL' || game.gameState === 'OFF')
          ) {
            // Fetch the full landing page for this game
            const landing = await fetchJsonWithRetry(
              `${NHL_API}/gamecenter/${game.id}/landing`
            );
            return landing as LandingResponse;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching recent game:', error);
  }
  return null;
}

async function fetchStandings(): Promise<StandingsTeam[]> {
  try {
    const data = await fetchJsonWithRetry(`${NHL_API}/standings/now`);
    return (data.standings || []) as StandingsTeam[];
  } catch (error) {
    console.error('Error fetching standings:', error);
    return [];
  }
}

async function fetchNextGame(
  teamConfig: typeof TEAMS[string]
): Promise<{ opponent: string; date: string; time: string; ticketLink: string } | null> {
  try {
    const schedule = await fetchJsonWithRetry(
      `${NHL_API}/club-schedule-season/${teamConfig.abbreviation}/now`
    );

    const now = new Date();
    const games = (schedule.games || []) as Array<{
      id: number;
      gameDate: string;
      startTimeUTC: string;
      gameState: string;
      homeTeam: { abbrev: string };
      awayTeam: { abbrev: string };
    }>;

    const nextGame = games.find((g) => {
      const gameDate = new Date(g.startTimeUTC);
      return gameDate > now && g.gameState === 'FUT';
    });

    if (!nextGame) return null;

    const isHome = nextGame.homeTeam.abbrev === teamConfig.abbreviation;
    const oppAbbrev = isHome ? nextGame.awayTeam.abbrev : nextGame.homeTeam.abbrev;
    const oppConfig = Object.values(TEAMS).find((t) => t.abbreviation === oppAbbrev);
    const opponent = oppConfig ? `${isHome ? 'vs' : '@'} ${oppConfig.city} ${oppConfig.name}` : oppAbbrev;

    const gameDate = new Date(nextGame.startTimeUTC);
    const dateStr = gameDate.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      timeZone: 'America/New_York',
    });
    const timeStr = gameDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York',
    });

    // Generate ticket link (always link to home team's StubHub page)
    const homeConfig = isHome ? teamConfig : oppConfig;
    const ticketLink = homeConfig
      ? generateGameTicketLink(
          homeConfig.slug,
          homeConfig.city,
          homeConfig.stubhubId,
          nextGame.homeTeam.abbrev,
          nextGame.awayTeam.abbrev,
          nextGame.gameDate
        )
      : '#';

    return { opponent, date: dateStr, time: timeStr, ticketLink };
  } catch (error) {
    console.error('Error fetching next game:', error);
    return null;
  }
}

// ─── Boxscore Email Template ─────────────────────────────────────

function renderBoxscoreEmail(data: GameRecapData, blogPost?: BlogPost): string {
  const { teamConfig, landing, nextGame, probBefore, probAfter, oppProbBefore, oppProbAfter, seasonStats } = data;
  const primaryColor = teamConfig.colors.primary;
  const isHome = landing.homeTeam.abbrev === teamConfig.abbreviation;
  const teamScore = isHome ? landing.homeTeam.score : landing.awayTeam.score;
  const oppScore = isHome ? landing.awayTeam.score : landing.homeTeam.score;
  const oppAbbrev = isHome ? landing.awayTeam.abbrev : landing.homeTeam.abbrev;
  const oppConfig = Object.values(TEAMS).find((t) => t.abbreviation === oppAbbrev);
  const won = teamScore > oppScore;
  const periodType = landing.gameOutcome?.lastPeriodType;
  const finalLabel = periodType === 'OT' ? 'FINAL/OT' : periodType === 'SO' ? 'FINAL/SO' : 'FINAL';

  const trackerUrl = `${SITE_URL}/${data.teamSlug}?utm_source=newsletter&utm_medium=email&utm_campaign=game-recap&utm_content=tracker`;
  const unsubscribeUrl = '{{UNSUBSCRIBE_URL}}';

  // Collect goal scorers
  const goalsByTeam = collectGoalScorers(landing, teamConfig.abbreviation);

  // Three stars
  const threeStars = landing.summary?.threeStars || [];

  // Probability changes for both teams
  const teamProbDelta = probAfter - probBefore;
  const teamProbDeltaStr = teamProbDelta >= 0 ? `+${Math.round(teamProbDelta)}%` : `${Math.round(teamProbDelta)}%`;
  const teamProbColor = teamProbDelta >= 0 ? '#16a34a' : '#dc2626';
  const teamProbArrow = teamProbDelta >= 0 ? '&#9652;' : '&#9662;';

  const oppProbDelta = oppProbAfter - oppProbBefore;
  const oppProbDeltaStr = oppProbDelta >= 0 ? `+${Math.round(oppProbDelta)}%` : `${Math.round(oppProbDelta)}%`;
  const oppProbColor = oppProbDelta >= 0 ? '#16a34a' : '#dc2626';
  const oppProbArrow = oppProbDelta >= 0 ? '&#9652;' : '&#9662;';

  // Team logos (NHL CDN)
  const teamLogo = `https://assets.nhle.com/logos/nhl/svg/${teamConfig.abbreviation}_light.svg`;
  const oppLogo = oppConfig
    ? `https://assets.nhle.com/logos/nhl/svg/${oppConfig.abbreviation}_light.svg`
    : '';

  // Away team is always listed first in the score block
  const awayAbbrev = isHome ? oppAbbrev : teamConfig.abbreviation;
  const homeAbbrevDisplay = isHome ? teamConfig.abbreviation : oppAbbrev;
  const awayLogo = isHome ? oppLogo : teamLogo;
  const homeLogo = isHome ? teamLogo : oppLogo;
  const awayScore = isHome ? oppScore : teamScore;
  const homeScore = isHome ? teamScore : oppScore;
  const awayWon = awayScore > homeScore;
  const homeWon = homeScore > awayScore;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${primaryColor};padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><h1 style="margin:0;color:#ffffff;font-size:22px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;font-style:normal;">Lindy's Five</h1></td>
              <td align="right"><span style="color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Game Recap</span></td>
            </tr>
          </table>
        </td></tr>

        <!-- Score Block -->
        <tr><td style="padding:24px 20px 20px;background:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" width="35%">
                <img src="${awayLogo}" alt="${awayAbbrev}" width="48" style="display:block;margin:0 auto 8px;max-height:48px;" />
                <span style="font-size:14px;font-weight:700;color:#1e293b;">${awayAbbrev}</span>
              </td>
              <td align="center" width="30%">
                <table cellpadding="0" cellspacing="0">
                  <tr>
                    <td align="right" style="font-size:32px;font-weight:800;color:${awayWon ? '#1e293b' : '#64748b'};padding-right:6px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;">${awayScore}</td>
                    <td style="font-size:18px;color:#94a3b8;padding:0 2px;">-</td>
                    <td align="left" style="font-size:32px;font-weight:800;color:${homeWon ? '#1e293b' : '#64748b'};padding-left:6px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;">${homeScore}</td>
                  </tr>
                </table>
                <span style="display:block;margin-top:4px;font-size:11px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;">${finalLabel}</span>
              </td>
              <td align="center" width="35%">
                <img src="${homeLogo}" alt="${homeAbbrevDisplay}" width="48" style="display:block;margin:0 auto 8px;max-height:48px;" />
                <span style="font-size:14px;font-weight:700;color:#1e293b;">${homeAbbrevDisplay}</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Playoff Impact (both teams) -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Playoff Impact</span>
            </td></tr>
            <tr><td style="padding:4px 16px 6px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="28" valign="middle"><img src="${teamLogo}" alt="${teamConfig.abbreviation}" width="24" style="display:block;max-height:24px;" /></td>
                  <td valign="middle" style="padding-left:8px;">
                    <span style="font-size:14px;font-weight:700;color:#1e293b;">${teamConfig.name}</span><br/>
                    <span style="font-size:13px;color:#64748b;">${probBefore}% &rarr; ${probAfter}%</span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size:14px;font-weight:700;color:${teamProbColor};">${teamProbArrow} ${teamProbDeltaStr}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:0 16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e2e8f0;"></td></tr></table></td></tr>
            <tr><td style="padding:6px 16px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="28" valign="middle"><img src="${oppLogo}" alt="${oppAbbrev}" width="24" style="display:block;max-height:24px;" /></td>
                  <td valign="middle" style="padding-left:8px;">
                    <span style="font-size:14px;font-weight:700;color:#1e293b;">${oppConfig?.name || oppAbbrev}</span><br/>
                    <span style="font-size:13px;color:#64748b;">${oppProbBefore}% &rarr; ${oppProbAfter}%</span>
                  </td>
                  <td align="right" valign="middle">
                    <span style="font-size:14px;font-weight:700;color:${oppProbColor};">${oppProbArrow} ${oppProbDeltaStr}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Playoff Probability -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Playoff Probability</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:8px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;border-radius:4px;height:8px;">
                        <tr><td style="width:${probAfter}%;background:${primaryColor};border-radius:4px;height:8px;"></td><td></td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:4px;"><span style="font-size:20px;font-weight:800;color:#1e293b;">${probAfter}%</span></td>
                    <td align="right" style="padding-top:4px;"><a href="${trackerUrl}" style="font-size:12px;color:${primaryColor};text-decoration:none;font-weight:600;">View Full Tracker &rarr;</a></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Season Progress (2x2 grid for mobile) -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Season Progress</span>
            </td></tr>
            <tr><td style="padding:4px 16px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Record</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.record}</span>
                  </td>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Points</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.points}</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Pace</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.pace}</span>
                  </td>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Projected</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.projected}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Goal Scorers -->
        ${renderGoalScorersSection(goalsByTeam, teamConfig.abbreviation, oppAbbrev, primaryColor)}

        <!-- Three Stars -->
        ${renderThreeStarsSection(threeStars)}

        <!-- Next Game CTA -->
        ${nextGame ? renderNextGameCTA(nextGame, primaryColor) : ''}

        <!-- Blog Recap Link (Sabres only) -->
        ${blogPost ? renderBlogLink(blogPost) : ''}

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><p style="margin:0;color:#94a3b8;font-size:12px;">Lindy's Five &mdash; NHL Playoff Odds &amp; Standings</p></td>
              <td align="right"><a href="${unsubscribeUrl}" style="color:#94a3b8;font-size:12px;text-decoration:none;">Unsubscribe</a></td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Email Section Renderers ─────────────────────────────────────

function collectGoalScorers(
  landing: LandingResponse,
  teamAbbrev: string
): { team: ScoringGoal[]; opponent: ScoringGoal[] } {
  const team: ScoringGoal[] = [];
  const opponent: ScoringGoal[] = [];

  for (const period of landing.summary?.scoring || []) {
    for (const goal of period.goals) {
      if (goal.teamAbbrev?.default === teamAbbrev) {
        team.push(goal);
      } else {
        opponent.push(goal);
      }
    }
  }

  return { team, opponent };
}

function renderGoalScorersSection(
  goals: { team: ScoringGoal[]; opponent: ScoringGoal[] },
  teamAbbrev: string,
  oppAbbrev: string,
  primaryColor: string
): string {
  if (goals.team.length === 0 && goals.opponent.length === 0) return '';

  const renderGoalList = (scorers: ScoringGoal[], abbrev: string) => {
    if (scorers.length === 0) return `<tr><td style="padding:4px 0;color:#94a3b8;font-size:13px;">No goals</td></tr>`;
    return scorers.map((g) => {
      const name = `${g.firstName?.default || ''} ${g.lastName?.default || ''}`.trim();
      const assists = g.assists?.map((a) => `${a.firstName?.default?.[0]}. ${a.lastName?.default}`).join(', ');
      const special = g.strength === 'pp' ? ' (PP)' : g.strength === 'sh' ? ' (SH)' : g.strength === 'en' ? ' (EN)' : '';
      return `<tr><td style="padding:3px 0;font-size:13px;color:#334155;">
        <strong>${name}</strong>${special}${assists ? ` <span style="color:#94a3b8;">— ${assists}</span>` : ''}
      </td></tr>`;
    }).join('');
  };

  return `
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Goal Scorers</span>
            </td></tr>
            <tr><td style="padding:4px 16px 10px;">
              <span style="display:block;font-size:12px;font-weight:700;color:${primaryColor};margin-bottom:4px;">${teamAbbrev}</span>
              <table cellpadding="0" cellspacing="0" width="100%">${renderGoalList(goals.team, teamAbbrev)}</table>
            </td></tr>
            <tr><td style="padding:0 16px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:1px solid #e2e8f0;"></td></tr></table></td></tr>
            <tr><td style="padding:10px 16px 14px;">
              <span style="display:block;font-size:12px;font-weight:700;color:#64748b;margin-bottom:4px;">${oppAbbrev}</span>
              <table cellpadding="0" cellspacing="0" width="100%">${renderGoalList(goals.opponent, oppAbbrev)}</table>
            </td></tr>
          </table>
        </td></tr>`;
}

function renderThreeStarsSection(stars: ThreeStar[]): string {
  if (stars.length === 0) return '';

  const starLabels = ['1st', '2nd', '3rd'];
  const starsHtml = stars
    .sort((a, b) => a.star - b.star)
    .slice(0, 3)
    .map((s, i) => {
      const name = s.name?.default || `${s.firstName?.default} ${s.lastName?.default}`;
      const statLine = [
        s.goals > 0 ? `${s.goals}G` : '',
        s.assists > 0 ? `${s.assists}A` : '',
      ].filter(Boolean).join(', ') || `${s.position}`;

      return `
            <tr><td style="padding:6px 0;${i < 2 ? 'border-bottom:1px solid #e2e8f0;' : ''}">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" valign="middle"><img src="${s.headshot}" alt="${name}" width="40" height="40" style="border-radius:50%;display:block;" /></td>
                  <td valign="middle" style="padding-left:10px;">
                    <span style="font-size:10px;color:#94a3b8;font-weight:700;">${starLabels[i]} Star</span><br/>
                    <span style="font-size:13px;font-weight:700;color:#1e293b;">${name}</span>
                    <span style="font-size:12px;color:#64748b;"> &middot; ${typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default} &middot; ${statLine}</span>
                  </td>
                </tr>
              </table>
            </td></tr>`;
    })
    .join('');

  return `
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Three Stars</span>
            </td></tr>
            <tr><td style="padding:4px 16px 10px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${starsHtml}
              </table>
            </td></tr>
          </table>
        </td></tr>`;
}

function renderNextGameCTA(
  nextGame: { opponent: string; date: string; time: string; ticketLink: string },
  primaryColor: string
): string {
  return `
        <tr><td style="padding:0 20px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:${primaryColor};border-radius:8px;">
            <tr><td style="padding:20px 16px;" align="center">
              <span style="display:block;font-size:11px;font-weight:700;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Next Game</span>
              <span style="display:block;font-size:18px;font-weight:800;color:#ffffff;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;font-style:normal;">${nextGame.opponent}</span>
              <span style="display:block;font-size:14px;color:rgba(255,255,255,0.8);margin:6px 0 16px;">${nextGame.date} &middot; ${nextGame.time} ET</span>
              <a href="${nextGame.ticketLink}" style="display:inline-block;background:#ffffff;color:${primaryColor};padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px;">
                Get Tickets
              </a>
            </td></tr>
          </table>
        </td></tr>`;
}

function renderBlogLink(post: BlogPost): string {
  const postUrl = `${SITE_URL}/blog/${post.team}/${post.slug}?utm_source=newsletter&utm_medium=email&utm_campaign=game-recap&utm_content=blog-link`;
  return `
        <tr><td style="padding:0 20px 20px;" align="center">
          <a href="${postUrl}" style="display:inline-block;background:#ffffff;color:#003087;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:13px;border:2px solid #003087;">
            Read Full Written Recap &rarr;
          </a>
        </td></tr>`;
}

// ─── Set Recap Email Template ────────────────────────────────────

interface SetRecapEmailData {
  teamConfig: typeof TEAMS[string];
  set: GameChunk;
  dateRange: string;
  targetPoints: number;
  targetMet: boolean;
  seasonStats: { gamesPlayed: number; points: number; pace: string; projected: number; record: string };
  probAfter: number;
  primaryColor: string;
  trackerUrl: string;
  nextGame: { opponent: string; date: string; time: string; ticketLink: string } | null;
}

function renderSetRecapEmail(data: SetRecapEmailData): string {
  const { teamConfig, set, dateRange, targetPoints, targetMet, seasonStats, probAfter, primaryColor, trackerUrl, nextGame } = data;
  const unsubscribeUrl = '{{UNSUBSCRIBE_URL}}';

  // Game results rows
  const gameRowsHtml = set.games
    .filter((g) => g.outcome !== 'PENDING')
    .map((g) => {
      const outcomeColor = g.outcome === 'W' ? '#16a34a' : g.outcome === 'OTL' ? '#f59e0b' : '#dc2626';
      const outcomeLabel = g.outcome === 'W' ? 'WIN' : g.outcome === 'OTL' ? 'OTL' : 'LOSS';
      const ptsLabel = g.outcome === 'W' ? '2 PTS' : g.outcome === 'OTL' ? '1 PT' : '0 PTS';
      const dateLabel = formatShortDate(g.date);
      const oppLogo = g.opponentLogo || '';
      const oppAbbrev = g.opponentAbbreviation || g.opponent;
      const homeAway = g.isHome ? 'vs' : '@';

      return `
            <tr>
              <td style="padding:8px 0;border-bottom:1px solid #e2e8f0;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td width="55" style="font-size:12px;color:#94a3b8;white-space:nowrap;">${dateLabel}</td>
                    <td>
                      <table cellpadding="0" cellspacing="0"><tr>
                        <td style="font-size:12px;color:#94a3b8;padding-right:6px;">${homeAway}</td>
                        <td><img src="${oppLogo}" alt="${oppAbbrev}" width="20" style="display:block;max-height:20px;" /></td>
                        <td style="font-size:13px;font-weight:600;color:#1e293b;padding-left:6px;">${oppAbbrev}</td>
                      </tr></table>
                    </td>
                    <td width="65" align="center" style="font-size:14px;font-weight:700;color:#1e293b;">${g.sabresScore} - ${g.opponentScore}</td>
                    <td width="40" align="right"><span style="font-size:12px;font-weight:700;color:${outcomeColor};">${outcomeLabel}</span></td>
                  </tr>
                </table>
              </td>
            </tr>`;
    })
    .join('');

  const targetBadgeColor = targetMet ? '#16a34a' : '#dc2626';
  const targetBadgeBg = targetMet ? '#f0fdf4' : '#fef2f2';
  const targetIcon = targetMet ? '&#10003;' : '&#10007;';
  const targetText = targetMet ? `Target Met! (${targetPoints}+ points)` : `Missed Target (${set.points} of ${targetPoints}+)`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:${primaryColor};padding:16px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><h1 style="margin:0;color:#ffffff;font-size:22px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;font-style:normal;">Lindy's Five</h1></td>
              <td align="right"><span style="color:rgba(255,255,255,0.7);font-size:12px;text-transform:uppercase;letter-spacing:1px;">Set Recap</span></td>
            </tr>
          </table>
        </td></tr>

        <!-- Set Summary Hero -->
        <tr><td style="padding:24px 20px 20px;background:#ffffff;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td>
                <span style="display:block;font-size:24px;font-weight:800;color:#1e293b;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;text-transform:uppercase;letter-spacing:1px;font-style:normal;">Set ${set.chunkNumber}</span>
                <span style="display:block;font-size:13px;color:#64748b;margin-top:2px;">${dateRange}</span>
              </td>
              <td align="right">
                <span style="display:block;font-size:32px;font-weight:800;color:${primaryColor};font-family:Impact,'Arial Narrow',Helvetica,sans-serif;font-style:normal;">${set.points}</span>
                <span style="display:block;font-size:12px;color:#64748b;">of ${set.maxPoints} points</span>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Record Row -->
        <tr><td style="padding:0 20px 12px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td align="center" width="33%" style="padding:8px 4px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border-radius:8px;">
                  <tr><td align="center" style="padding:10px 4px;">
                    <span style="display:block;font-size:24px;font-weight:800;color:#16a34a;">${set.wins}</span>
                    <span style="display:block;font-size:10px;font-weight:700;color:#16a34a;text-transform:uppercase;">Wins</span>
                  </td></tr>
                </table>
              </td>
              <td align="center" width="33%" style="padding:8px 4px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fefce8;border-radius:8px;">
                  <tr><td align="center" style="padding:10px 4px;">
                    <span style="display:block;font-size:24px;font-weight:800;color:#ca8a04;">${set.otLosses}</span>
                    <span style="display:block;font-size:10px;font-weight:700;color:#ca8a04;text-transform:uppercase;">OTL</span>
                  </td></tr>
                </table>
              </td>
              <td align="center" width="33%" style="padding:8px 4px;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border-radius:8px;">
                  <tr><td align="center" style="padding:10px 4px;">
                    <span style="display:block;font-size:24px;font-weight:800;color:#dc2626;">${set.losses}</span>
                    <span style="display:block;font-size:10px;font-weight:700;color:#dc2626;text-transform:uppercase;">Losses</span>
                  </td></tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Target Badge -->
        <tr><td style="padding:0 20px 20px;" align="center">
          <span style="display:inline-block;background:${targetBadgeBg};color:${targetBadgeColor};padding:8px 20px;border-radius:20px;font-size:13px;font-weight:700;">${targetIcon} ${targetText}</span>
        </td></tr>

        <!-- Game Results -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Game Results</span>
            </td></tr>
            <tr><td style="padding:4px 16px 12px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                ${gameRowsHtml}
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Playoff Probability -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr>
              <td style="padding:14px 16px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td colspan="2"><span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Playoff Probability</span></td>
                  </tr>
                  <tr>
                    <td colspan="2" style="padding-top:8px;">
                      <table width="100%" cellpadding="0" cellspacing="0" style="background:#e2e8f0;border-radius:4px;height:8px;">
                        <tr><td style="width:${probAfter}%;background:${primaryColor};border-radius:4px;height:8px;"></td><td></td></tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding-top:4px;"><span style="font-size:20px;font-weight:800;color:#1e293b;">${probAfter}%</span></td>
                    <td align="right" style="padding-top:4px;"><a href="${trackerUrl}" style="font-size:12px;color:${primaryColor};text-decoration:none;font-weight:600;">View Full Tracker &rarr;</a></td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td></tr>

        <!-- Season Progress (2x2 grid for mobile) -->
        <tr><td style="padding:0 20px 20px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0;">
            <tr><td style="padding:12px 16px 4px;">
              <span style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Season Progress</span>
            </td></tr>
            <tr><td style="padding:4px 16px 14px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Record</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.record}</span>
                  </td>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Points</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.points}</span>
                  </td>
                </tr>
                <tr>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Pace</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.pace}</span>
                  </td>
                  <td align="center" width="50%" style="padding:6px 0;">
                    <span style="display:block;font-size:11px;color:#94a3b8;text-transform:uppercase;">Projected</span>
                    <span style="display:block;font-size:16px;font-weight:700;color:#1e293b;">${seasonStats.projected}</span>
                  </td>
                </tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- Next Game CTA -->
        ${nextGame ? renderNextGameCTA(nextGame, primaryColor) : ''}

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td><p style="margin:0;color:#94a3b8;font-size:12px;">Lindy's Five &mdash; NHL Playoff Odds &amp; Standings</p></td>
              <td align="right"><a href="${unsubscribeUrl}" style="color:#94a3b8;font-size:12px;text-decoration:none;">Unsubscribe</a></td>
            </tr>
          </table>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Set Recap Data Helpers ──────────────────────────────────────

async function fetchTeamSchedule(teamAbbrev: string, teamId: number): Promise<GameResult[]> {
  const season = getCurrentSeason();
  const data = await fetchJsonWithRetry(
    `${NHL_API}/club-schedule-season/${teamAbbrev}/${season}`
  );

  const games = (data.games || []) as Array<{
    id: number;
    gameDate: string;
    startTimeUTC: string;
    gameState: string;
    gameType: number;
    homeTeam: { id: number; abbrev: string; score: number; logo: string };
    awayTeam: { id: number; abbrev: string; score: number; logo: string };
    gameOutcome?: { lastPeriodType: string };
  }>;

  // Filter to regular season only
  const regularSeason = games.filter((g) => g.gameType === 2);

  return regularSeason.map((game): GameResult => {
    const isHome = game.homeTeam.id === teamId;
    const myTeam = isHome ? game.homeTeam : game.awayTeam;
    const oppTeam = isHome ? game.awayTeam : game.homeTeam;
    const isFinished = game.gameState === 'FINAL' || game.gameState === 'OFF';

    let outcome: 'W' | 'OTL' | 'L' | 'PENDING' = 'PENDING';
    let points = 0;

    if (isFinished) {
      const won = myTeam.score > oppTeam.score;
      const isOT = game.gameOutcome?.lastPeriodType === 'OT' || game.gameOutcome?.lastPeriodType === 'SO';
      if (won) { outcome = 'W'; points = 2; }
      else if (isOT) { outcome = 'OTL'; points = 1; }
      else { outcome = 'L'; points = 0; }
    }

    return {
      date: game.gameDate,
      startTime: game.startTimeUTC,
      opponent: oppTeam.abbrev,
      opponentLogo: oppTeam.logo,
      opponentAbbreviation: oppTeam.abbrev,
      isHome,
      sabresScore: myTeam.score || 0,
      opponentScore: oppTeam.score || 0,
      outcome,
      points,
      gameState: game.gameState,
      gameId: game.id,
    };
  });
}

function computeChunksFromSchedule(games: GameResult[], _teamId: number): GameChunk[] {
  const GAMES_PER_CHUNK = 5;
  const TOTAL_GAMES = 82;
  const totalChunks = Math.ceil(TOTAL_GAMES / GAMES_PER_CHUNK);
  const chunks: GameChunk[] = [];

  for (let i = 0; i < totalChunks; i++) {
    const startIndex = i * GAMES_PER_CHUNK;
    const endIndex = Math.min(startIndex + GAMES_PER_CHUNK, TOTAL_GAMES);
    const chunkGames = games.slice(startIndex, endIndex);
    const gamesInChunk = endIndex - startIndex;

    const wins = chunkGames.filter((g) => g.outcome === 'W').length;
    const otLosses = chunkGames.filter((g) => g.outcome === 'OTL').length;
    const losses = chunkGames.filter((g) => g.outcome === 'L').length;
    const points = chunkGames.reduce((sum, g) => sum + g.points, 0);
    const maxPoints = gamesInChunk * 2;
    const isComplete = chunkGames.length === gamesInChunk && chunkGames.every((g) => g.outcome !== 'PENDING');

    chunks.push({ chunkNumber: i + 1, games: chunkGames, totalGames: gamesInChunk, wins, otLosses, losses, points, maxPoints, isComplete });
  }

  return chunks;
}

function getCurrentSeason(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  // NHL season spans two calendar years. If before August, use previous year as start.
  if (month < 8) {
    return `${year - 1}${year}`;
  }
  return `${year}${year + 1}`;
}

function formatSetDateRange(firstDate?: string, lastDate?: string): string {
  if (!firstDate || !lastDate) return '';
  const first = new Date(firstDate + 'T12:00:00');
  const last = new Date(lastDate + 'T12:00:00');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const firstMonth = monthNames[first.getMonth()];
  const lastMonth = monthNames[last.getMonth()];
  if (firstMonth === lastMonth) {
    return `${firstMonth} ${first.getDate()}-${last.getDate()}`;
  }
  return `${firstMonth} ${first.getDate()} - ${lastMonth} ${last.getDate()}`;
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

// ─── Simple Blog Recap (fallback) ────────────────────────────────

function renderSimpleBlogRecap(post: BlogPost, postUrl: string): string {
  const teamConfig = TEAMS[post.team];
  const primaryColor = teamConfig?.colors.primary || '#003087';
  const teamName = teamConfig?.name || post.team;
  const trackerUrl = `${SITE_URL}/${post.team}?utm_source=newsletter&utm_medium=email&utm_campaign=blog-recap&utm_content=tracker`;
  const unsubscribeUrl = '{{UNSUBSCRIBE_URL}}';
  const contentHtml = markdownToEmailHtml(post.content);

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:20px 12px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${primaryColor};padding:20px;">
          <h1 style="margin:0;color:#ffffff;font-size:24px;font-family:Impact,'Arial Narrow',Helvetica,sans-serif;letter-spacing:2px;text-transform:uppercase;font-style:normal;">Lindy's Five</h1>
        </td></tr>
        <tr><td style="padding:20px;">
          <h2 style="margin:0 0 20px;color:#1e293b;font-size:22px;">${post.title}</h2>
          <p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">
            ${contentHtml}
          </p>
          <table cellpadding="0" cellspacing="0" width="100%" style="margin:28px 0;">
            <tr>
              <td style="padding-bottom:10px;">
                <a href="${postUrl}" style="display:block;background:${primaryColor};color:#ffffff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;text-align:center;">
                  Read Full Recap
                </a>
              </td>
            </tr>
            <tr>
              <td>
                <a href="${trackerUrl}" style="display:block;background:#ffffff;color:${primaryColor};padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;border:2px solid ${primaryColor};text-align:center;">
                  View ${teamName} Tracker
                </a>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 20px;border-top:1px solid #e2e8f0;">
          <p style="margin:0 0 8px;color:#94a3b8;font-size:12px;">Lindy's Five &mdash; NHL Playoff Odds &amp; Standings</p>
          <a href="${unsubscribeUrl}" style="color:#94a3b8;font-size:12px;">Unsubscribe</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function markdownToEmailHtml(markdown: string): string {
  return markdown
    .replace(/^### (.+)$/gm, '<h3 style="margin:20px 0 8px;color:#1e293b;font-size:16px;">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="margin:24px 0 12px;color:#1e293b;font-size:18px;">$1</h2>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 16px;color:#334155;font-size:15px;line-height:1.7;">')
    .replace(/\n/g, '<br>');
}

// ─── Batch Sending ────────────────────────────────────────────────

async function sendBatchEmails(subscribers: NewsletterSubscriber[], subject: string, htmlTemplate: string, sendRecordId?: string) {
  const BATCH_SIZE = 100;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);
    const emails = batch.map((sub) => {
      const unsubscribeUrl = `${SITE_URL}/api/newsletter/unsubscribe?id=${sub.id}`;
      const personalizedHtml = htmlTemplate.replace('{{UNSUBSCRIBE_URL}}', unsubscribeUrl);
      return {
        from: FROM_EMAIL,
        to: sub.email,
        subject,
        html: personalizedHtml,
        headers: {
          'List-Unsubscribe': `<${unsubscribeUrl}>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        },
      };
    });

    try {
      const response = await getResend().batch.send(emails);
      // Map Resend email IDs back to our send record for webhook tracking
      if (sendRecordId && response?.data) {
        // SDK returns { data } where data could be:
        // - Array of { id } directly from batch endpoint
        // - Object with nested { data: [{ id }] }
        const rawData = response.data as any;
        const resendIds: any[] = Array.isArray(rawData)
          ? rawData
          : Array.isArray(rawData?.data)
            ? rawData.data
            : [];
        for (const item of resendIds) {
          const emailId = typeof item === 'object' && item !== null && 'id' in item ? (item as { id: string }).id : null;
          if (emailId) {
            await kv.set(`email:resend-map:${emailId}`, sendRecordId, { ex: 60 * 60 * 24 * 30 });
          }
        }
        if (resendIds.length === 0) {
          console.warn('Resend batch: no IDs extracted. response.data:', JSON.stringify(rawData).slice(0, 500));
        } else {
          console.log(`Resend batch: mapped ${resendIds.length} email IDs to send record ${sendRecordId}`);
        }
      }
    } catch (error) {
      console.error(`Failed to send batch starting at index ${i}:`, error);
    }
  }
}

// ─── KV Helpers ───────────────────────────────────────────────────

export async function getVerifiedSubscribersForTeam(team: string): Promise<NewsletterSubscriber[]> {
  const subscriberIds = await kv.smembers<string[]>(`email:subscribers:team:${team}`);
  if (!subscriberIds || subscriberIds.length === 0) return [];

  const subscribers: NewsletterSubscriber[] = [];
  for (const id of subscriberIds) {
    const sub = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
    if (sub && sub.verified && !sub.unsubscribedAt) {
      subscribers.push(sub);
    }
  }
  return subscribers;
}

export async function getAllSubscribers(): Promise<NewsletterSubscriber[]> {
  const subscriberIds = await kv.smembers<string[]>('email:subscribers');
  if (!subscriberIds || subscriberIds.length === 0) return [];

  const subscribers: NewsletterSubscriber[] = [];
  for (const id of subscriberIds) {
    const sub = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
    if (sub) subscribers.push(sub);
  }
  return subscribers;
}

export async function deleteSubscriber(id: string): Promise<void> {
  const sub = await kv.get<NewsletterSubscriber>(`email:subscriber:${id}`);
  if (!sub) return;

  // Remove from global set
  await kv.srem('email:subscribers', id);

  // Remove from each team set
  for (const team of sub.teams) {
    await kv.srem(`email:subscribers:team:${team}`, id);
  }

  // Delete the subscriber record
  await kv.del(`email:subscriber:${id}`);
}

export async function getAllSendRecords(): Promise<EmailSendRecord[]> {
  const sendIds = await kv.zrange<string[]>('email:sends', 0, -1, { rev: true });
  if (!sendIds || sendIds.length === 0) return [];

  const records: EmailSendRecord[] = [];
  for (const id of sendIds) {
    const record = await kv.get<EmailSendRecord>(`email:send:${id}`);
    if (record) records.push(record);
  }
  return records;
}

async function recordEmailSend(team: string, recipientCount: number, subject: string): Promise<string> {
  const id = crypto.randomUUID();
  const record: EmailSendRecord = {
    id,
    postId: '',
    postSlug: '',
    team,
    sentAt: new Date().toISOString(),
    recipientCount,
    subject,
    delivered: 0,
    opened: 0,
    clicked: 0,
    bounced: 0,
    complained: 0,
  };
  await kv.set(`email:send:${id}`, record);
  await kv.zadd('email:sends', { score: Date.now(), member: id });
  return id;
}

export async function incrementSendStat(sendRecordId: string, stat: 'delivered' | 'opened' | 'clicked' | 'bounced' | 'complained') {
  const record = await kv.get<EmailSendRecord>(`email:send:${sendRecordId}`);
  if (!record) return;
  record[stat] = (record[stat] || 0) + 1;
  await kv.set(`email:send:${sendRecordId}`, record);
}

export async function getSendRecordIdForResendEmail(resendEmailId: string): Promise<string | null> {
  return kv.get<string>(`email:resend-map:${resendEmailId}`);
}

// ─── Exported for Cron / Multi-Team Use ──────────────────────────

export { sendBoxscoreRecapForTeam };
