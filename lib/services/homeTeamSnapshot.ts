import { NHL_TEAMS, MLB_TEAMS, getTeamUrl } from '@/lib/teamConfig';
import { resolveSeasonContext } from '@/lib/utils/seasonContext';
import { fetchTeamScheduleServer, fetchStandingsServer } from '@/lib/services/nhlTeamPageData';
import { calculateChunks, calculateSeasonStats } from '@/lib/utils/chunkCalculator';
import { getDivCutLine, getWcCutLine, getModelProjectedPoints, isInPlayoffPosition } from '@/lib/utils/standingsCalc';
import { computePositionAwareProbability } from '@/lib/utils/playoffProbability';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { getMLBPlayoffProbability, getMLBProjectedWins } from '@/lib/utils/mlbStandingsCalc';

/** Compact per-team summary for the home page "Your team" card. */
export interface TeamSnapshot {
  sport: 'nhl' | 'mlb';
  slug: string;
  name: string;
  shortName: string;
  url: string;
  odds: number | null;
  oddsNote: string;
  projection: { value: string; label: string; note?: string } | null;
  record: string | null;
  next: { label: string; text: string; daysUntil: number } | null;
}

function easternToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

function daysFromToday(isoDate: string): number {
  return Math.round((Date.parse(`${isoDate}T12:00:00Z`) - Date.parse(`${easternToday()}T12:00:00Z`)) / 86400000);
}

function dayLabel(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short', month: 'short', day: 'numeric' });
}

/** NHL schedule dates come back as MM/DD/YYYY. */
function isoFromUS(date: string): string {
  const [m, d, y] = date.split('/');
  return `${y}-${m}-${d}`;
}

function nextText(isoDate: string, isHome: boolean, opponent: string, time?: string): string {
  return `${dayLabel(isoDate)} ${isHome ? 'vs' : 'at'} ${opponent}${time ? ` · ${time}` : ''}`;
}

async function nhlSnapshot(slug: string): Promise<TeamSnapshot | null> {
  const team = NHL_TEAMS[slug];
  if (!team) return null;
  const snap: TeamSnapshot = {
    sport: 'nhl',
    slug,
    name: `${team.city} ${team.name}`,
    shortName: team.name,
    url: getTeamUrl(slug),
    odds: null,
    oddsNote: '',
    projection: null,
    record: null,
    next: null,
  };

  const ctx = await resolveSeasonContext(team.abbreviation);

  if (ctx.isPreseason) {
    const odds = ctx.preseason?.odds;
    if (odds) {
      snap.odds = odds.playoffProbability;
      snap.oddsNote = 'Preseason projection';
      snap.projection = { value: `~${odds.projectedPoints}`, label: 'Projected points', note: `${odds.projectedGames}-game season` };
    }
    const opener = ctx.preseason?.opener;
    if (opener) {
      const time = opener.startTimeUTC
        ? new Date(opener.startTimeUTC).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' })
        : undefined;
      snap.next = { label: 'Season opener', text: nextText(opener.date, opener.isHome, opener.opponent, time), daysUntil: daysFromToday(opener.date) };
    }
    return snap;
  }

  if (ctx.seasonComplete) {
    const r = ctx.summary?.finalRecord;
    if (r) snap.record = `${r.wins}-${r.losses}-${r.otLosses} · ${r.points} pts`;
    snap.oddsNote = 'Season complete';
    return snap;
  }

  const games = await fetchTeamScheduleServer(team, ctx.season);
  const standings = await fetchStandingsServer(easternToday());
  const standing = standings.find((t) => t.teamAbbrev.default === team.abbreviation);
  const chunks = calculateChunks(games, games.length || ctx.totalGames);
  const stats = calculateSeasonStats(chunks, games.length || ctx.totalGames);

  if (standing && stats.gamesPlayed > 0) {
    const { probability } = computePositionAwareProbability(
      getModelProjectedPoints(stats.totalPoints, stats.gamesPlayed),
      stats.gamesPlayed,
      getDivCutLine(standing, standings),
      getWcCutLine(standing, standings),
      isInPlayoffPosition(standing),
      standing.clinchIndicator,
    );
    snap.odds = Math.round(probability);
    snap.oddsNote = 'Updated after every game';
    snap.record = `${standing.wins}-${standing.losses}-${standing.otLosses} · ${standing.points} pts`;
    snap.projection = { value: `${Math.round(stats.projectedPoints)}`, label: 'Points pace' };
  }

  const next = games.find((g) => g.outcome === 'PENDING' && daysFromToday(isoFromUS(g.date)) >= 0);
  if (next) {
    const iso = isoFromUS(next.date);
    snap.next = { label: 'Next game', text: nextText(iso, next.isHome, next.opponent, next.startTime), daysUntil: daysFromToday(iso) };
  }
  return snap;
}

async function mlbSnapshot(slug: string): Promise<TeamSnapshot | null> {
  const team = MLB_TEAMS[slug];
  if (!team) return null;
  const snap: TeamSnapshot = {
    sport: 'mlb',
    slug,
    name: `${team.city} ${team.name}`,
    shortName: team.name,
    url: getTeamUrl(slug),
    odds: null,
    oddsNote: '',
    projection: null,
    record: null,
    next: null,
  };

  const season = Number(easternToday().slice(0, 4));
  const [games, standings] = await Promise.all([fetchMLBSchedule(team.mlbId, season), fetchMLBStandings(season)]);
  const standing = standings.find((t) => t.teamId === team.mlbId);

  if (standing && standing.wins + standing.losses > 0) {
    const gamesPlayed = standing.wins + standing.losses;
    snap.odds = Math.max(0, Math.min(100, Math.round(getMLBPlayoffProbability(standing, standings).probability)));
    snap.oddsNote = 'Updated after every game';
    snap.record = `${standing.wins}-${standing.losses}`;
    snap.projection = { value: `${Math.round(getMLBProjectedWins(standing.wins, gamesPlayed))}`, label: 'Win pace' };
  }

  const next = games.find((g) => g.outcome === 'PENDING' && g.isoDate && daysFromToday(g.isoDate) >= 0);
  if (next?.isoDate) {
    snap.next = { label: 'Next game', text: nextText(next.isoDate, next.isHome, next.opponent, next.startTime), daysUntil: daysFromToday(next.isoDate) };
  }
  return snap;
}

export async function getTeamSnapshot(slug: string): Promise<TeamSnapshot | null> {
  if (NHL_TEAMS[slug]) return nhlSnapshot(slug);
  if (MLB_TEAMS[slug]) return mlbSnapshot(slug);
  return null;
}
