import { sql } from 'drizzle-orm';
import { fetchJsonWithRetry } from '@/lib/fetchWithRetry';
import { db } from '@/lib/db';
import { games } from '@/lib/db/schema';

const ESPN_API_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';

export interface GameRow {
  espnId: string;
  season: number;
  weekLabel: string;
  opponent: string;
  home: boolean;
  kickoffAt: Date;
  status: 'scheduled' | 'final';
  result: 'W' | 'L' | 'T' | null;
}

// NFL league year starts in March, so Jan/Feb playoff games belong to the
// prior year's season (e.g. a Jan 2027 game is part of the 2026 season).
function seasonForKickoff(kickoff: Date): number {
  const year = kickoff.getUTCFullYear();
  const month = kickoff.getUTCMonth() + 1; // 1-12
  return month >= 3 ? year : year - 1;
}

// Map one ESPN schedule event to a GameRow. Returns null for events we skip
// (preseason, or anything missing the data we need).
export function mapEventToGame(event: any): GameRow | null {
  const competition = event?.competitions?.[0];
  if (!competition) return null;

  // seasonType.type: 1 = preseason, 2 = regular, 3 = postseason. Skip preseason.
  const seasonType = event?.seasonType?.type;
  if (seasonType === 1) return null;

  const competitors = competition.competitors || [];
  const bills = competitors.find((c: any) => c.team?.abbreviation === 'BUF');
  const opp = competitors.find((c: any) => c.team?.abbreviation !== 'BUF');
  if (!bills || !opp) return null;

  const kickoffAt = new Date(event.date);
  if (Number.isNaN(kickoffAt.getTime())) return null;

  const completed = competition.status?.type?.completed === true;

  let result: GameRow['result'] = null;
  if (completed) {
    const billsScore = Number(bills.score);
    const oppScore = Number(opp.score);
    if (bills.winner === true) result = 'W';
    else if (opp.winner === true) result = 'L';
    else if (!Number.isNaN(billsScore) && !Number.isNaN(oppScore)) {
      result = billsScore > oppScore ? 'W' : billsScore < oppScore ? 'L' : 'T';
    } else {
      result = 'T';
    }
  }

  return {
    espnId: String(event.id),
    season: seasonForKickoff(kickoffAt),
    weekLabel: event.week?.text || (seasonType === 3 ? 'Postseason' : 'Regular Season'),
    opponent: opp.team?.displayName || opp.team?.name || opp.team?.abbreviation || 'Opponent',
    home: bills.homeAway === 'home',
    kickoffAt,
    status: completed ? 'final' : 'scheduled',
    result,
  };
}

export async function fetchBillsScheduleEvents(): Promise<any[]> {
  const data = await fetchJsonWithRetry(`${ESPN_API_BASE}/teams/buf/schedule`);
  return data?.events || [];
}

export interface IngestResult {
  fetched: number;
  upserted: number;
  skipped: number;
}

// Idempotent: upserts each event into games keyed by espn_id. Safe to run
// repeatedly (catches reschedules, score/status updates). Never deletes.
export async function ingestBillsSchedule(): Promise<IngestResult> {
  const events = await fetchBillsScheduleEvents();
  const rows = events.map(mapEventToGame).filter((r): r is GameRow => r !== null);

  for (const row of rows) {
    await db
      .insert(games)
      .values(row)
      .onConflictDoUpdate({
        target: games.espnId,
        set: {
          season: row.season,
          weekLabel: row.weekLabel,
          opponent: row.opponent,
          home: row.home,
          kickoffAt: row.kickoffAt,
          status: row.status,
          result: row.result,
        },
      });
  }

  return { fetched: events.length, upserted: rows.length, skipped: events.length - rows.length };
}

// Used by the grading pass to recompute the season's qualification threshold.
export async function countFinalGames(season: number): Promise<number> {
  const result = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(games)
    .where(sql`${games.season} = ${season} AND ${games.status} = 'final'`);
  return result[0]?.n ?? 0;
}
