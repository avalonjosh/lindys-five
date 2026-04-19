'use client';

import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import type { ConferenceBracket, PlayoffGame, BracketMatchup } from '@/lib/types/playoffs';
import { TEAMS } from '@/lib/teamConfig';

interface PlayoffScheduleListProps {
  eastern: ConferenceBracket;
  western: ConferenceBracket;
}

interface ScheduleRow {
  game: PlayoffGame;
  matchup: BracketMatchup;
  homeTeamIsTop: boolean;
}

function flattenGames(...confs: ConferenceBracket[]): ScheduleRow[] {
  const rows: ScheduleRow[] = [];
  for (const conf of confs) {
    for (const round of conf.rounds || []) {
      for (const m of round.matchups || []) {
        if (!m.topSeed || !m.bottomSeed) continue;
        for (const g of m.games || []) {
          const homeTeamIsTop = g.homeTeam.abbrev === m.topSeed.abbrev;
          rows.push({ game: g, matchup: m, homeTeamIsTop });
        }
      }
    }
  }
  return rows;
}

function formatDateHeader(iso: string): string {
  // iso is YYYY-MM-DD from NHL (already ET-aligned)
  const [y, mo, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, (mo || 1) - 1, d || 1, 12, 0, 0));
  return dt.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTime(utc: string | undefined): string {
  if (!utc) return 'TBD';
  return new Date(utc).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

function teamConfigByAbbrev(abbrev: string) {
  return Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
}

function GameRow({ row }: { row: ScheduleRow }) {
  const { game, matchup, homeTeamIsTop } = row;
  const topCfg = teamConfigByAbbrev(matchup.topSeed!.abbrev);
  const botCfg = teamConfigByAbbrev(matchup.bottomSeed!.abbrev);

  const homeCfg = homeTeamIsTop ? topCfg : botCfg;
  const awayCfg = homeTeamIsTop ? botCfg : topCfg;

  const topSeedWins = matchup.topSeedWins;
  const bottomSeedWins = matchup.bottomSeedWins;
  const isFinal = game.gameState === 'FINAL' || game.gameState === 'OFF';
  const isLive = game.gameState === 'LIVE' || game.gameState === 'CRIT';
  const isTbd = game.gameScheduleState === 'TBD';

  const homeScore = game.homeTeam.score ?? 0;
  const awayScore = game.awayTeam.score ?? 0;
  const periodSuffix = game.gameOutcome?.lastPeriodType === 'OT' ? ' OT' : game.gameOutcome?.lastPeriodType === 'SO' ? ' SO' : '';

  // Series-state line, always shown so users can see series context at a glance.
  const topAbbrev = matchup.topSeed!.abbrev;
  const botAbbrev = matchup.bottomSeed!.abbrev;
  let seriesStatus: string;
  if (topSeedWins >= 4) seriesStatus = `${topAbbrev} wins ${topSeedWins}-${bottomSeedWins}`;
  else if (bottomSeedWins >= 4) seriesStatus = `${botAbbrev} wins ${bottomSeedWins}-${topSeedWins}`;
  else if (topSeedWins > bottomSeedWins) seriesStatus = `${topAbbrev} leads ${topSeedWins}-${bottomSeedWins}`;
  else if (bottomSeedWins > topSeedWins) seriesStatus = `${botAbbrev} leads ${bottomSeedWins}-${topSeedWins}`;
  else if (topSeedWins === 0 && bottomSeedWins === 0) seriesStatus = 'Series 0-0';
  else seriesStatus = `Series tied ${topSeedWins}-${bottomSeedWins}`;

  const rowBody = (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 py-3 px-3 sm:px-4 rounded-lg bg-white border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all">
      {/* Away team (left) */}
      <div className="flex items-center justify-end gap-2 min-w-0">
        <span className="text-sm sm:text-base font-bold text-gray-900 truncate">
          {awayCfg?.abbreviation || game.awayTeam.abbrev}
        </span>
        {awayCfg?.logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={awayCfg.logo} alt={awayCfg.abbreviation} className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 object-contain" />
        )}
      </div>

      {/* Center: status/time + optional series-state line */}
      <div className="flex flex-col items-center min-w-[120px] sm:min-w-[150px]">
        {isFinal ? (
          <>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Final{periodSuffix}</span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-gray-900">
              {awayScore}–{homeScore}
            </span>
          </>
        ) : isLive ? (
          <>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
              <span className="w-1.5 h-1.5 rounded-full bg-red-600 animate-pulse" />
              Live
            </span>
            <span className="text-sm sm:text-base font-bold tabular-nums text-gray-900">
              {awayScore}–{homeScore}
            </span>
          </>
        ) : isTbd ? (
          <>
            <span className="text-xs font-bold text-gray-500">TBD</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Gm {game.gameNumber}</span>
          </>
        ) : (
          <>
            <span className="text-xs sm:text-sm font-bold text-gray-900">{formatTime(game.startTimeUTC)}</span>
            <span className="text-[10px] uppercase tracking-wider text-gray-400">Gm {game.gameNumber}</span>
          </>
        )}
        {seriesStatus && (
          <span className="mt-1 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200 whitespace-nowrap">
            {seriesStatus}
          </span>
        )}
      </div>

      {/* Home team (right) */}
      <div className="flex items-center gap-2 min-w-0">
        {homeCfg?.logo && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={homeCfg.logo} alt={homeCfg.abbreviation} className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 object-contain" />
        )}
        <span className="text-sm sm:text-base font-bold text-gray-900 truncate">
          {homeCfg?.abbreviation || game.homeTeam.abbrev}
        </span>
      </div>
    </div>
  );

  if (isTbd || !game.gameId) {
    return rowBody;
  }
  return (
    <Link href={`/nhl/scores/${game.gameId}`} className="block">
      {rowBody}
    </Link>
  );
}

function getTodayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

// Extract a YYYY-MM-DD date (ET) from the best available field — explicit gameDate, or converted from startTimeUTC.
function deriveDateKey(game: PlayoffGame): string | null {
  if (game.gameDate && game.gameDate.length >= 10) return game.gameDate.slice(0, 10);
  if (game.startTimeUTC) {
    // Convert UTC → Eastern date. en-CA yields YYYY-MM-DD format.
    try {
      const dt = new Date(game.startTimeUTC);
      return dt.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
    } catch {
      return null;
    }
  }
  return null;
}

export default function PlayoffScheduleList({ eastern, western }: PlayoffScheduleListProps) {
  const allRows = flattenGames(eastern, western);

  // Partition: any row with a derivable date → grouped by that date; truly undated → collapsed TBD section
  const byDate = new Map<string, ScheduleRow[]>();
  const tbd: ScheduleRow[] = [];
  for (const r of allRows) {
    const key = deriveDateKey(r.game);
    if (key) {
      if (!byDate.has(key)) byDate.set(key, []);
      byDate.get(key)!.push(r);
    } else {
      tbd.push(r);
    }
  }
  const sortedDates = Array.from(byDate.keys()).sort();

  // Within each date, sort by startTimeUTC (earliest first)
  for (const key of sortedDates) {
    byDate.get(key)!.sort((a, b) => {
      const ta = a.game.startTimeUTC || '';
      const tb = b.game.startTimeUTC || '';
      return ta.localeCompare(tb);
    });
  }

  // Sort TBD games by series letter + game number so they're stable
  tbd.sort((a, b) => {
    const la = a.matchup.seriesLetter;
    const lb = b.matchup.seriesLetter;
    if (la !== lb) return la.localeCompare(lb);
    return a.game.gameNumber - b.game.gameNumber;
  });

  const hasDated = sortedDates.length > 0;

  if (!hasDated && tbd.length === 0) {
    return (
      <div className="text-center py-12 text-sm text-gray-500">
        Schedule not published yet.
      </div>
    );
  }

  const todayET = getTodayET();
  const pastDates = sortedDates.filter((d) => d < todayET);
  const currentDates = sortedDates.filter((d) => d >= todayET);
  const pastGameCount = pastDates.reduce((sum, d) => sum + byDate.get(d)!.length, 0);
  const hasLiveInPast = pastDates.some((d) =>
    byDate.get(d)!.some((r) => r.game.gameState === 'LIVE' || r.game.gameState === 'CRIT')
  );

  const renderDateSection = (date: string) => {
    const rows = byDate.get(date)!;
    return (
      <section key={date}>
        <div className="flex items-baseline justify-between mb-3 pb-2 border-b border-gray-200">
          <h3 className="text-lg sm:text-xl font-bold text-gray-900">
            {formatDateHeader(date)}
          </h3>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {rows.length} {rows.length === 1 ? 'Game' : 'Games'}
          </span>
        </div>
        <div className="space-y-2">
          {rows.map((r) => (
            <GameRow key={r.game.gameId} row={r} />
          ))}
        </div>
      </section>
    );
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {pastDates.length > 0 && (
        <details className="group" open={hasLiveInPast}>
          <summary className="cursor-pointer list-none flex items-center justify-between py-1.5 border-b border-gray-100 hover:border-gray-200 transition-colors">
            <span className="text-xs font-medium uppercase tracking-wider text-gray-400 group-hover:text-gray-500">
              Completed Games
            </span>
            <ChevronDown
              size={20}
              className="text-gray-500 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="space-y-6 mt-4">
            {pastDates.map(renderDateSection)}
          </div>
        </details>
      )}

      {currentDates.map(renderDateSection)}

      {tbd.length > 0 && (
        <details className="group" open={currentDates.length === 0}>
          <summary className="cursor-pointer list-none flex items-center justify-between mb-3 pb-2 border-b border-gray-200 hover:border-gray-300 transition-colors">
            <h3 className="text-lg sm:text-xl font-bold text-gray-700">
              Schedule TBD
            </h3>
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
              {tbd.length} {tbd.length === 1 ? 'Game' : 'Games'}
              <ChevronDown
                size={20}
                className="text-gray-500 transition-transform duration-200 group-open:rotate-180"
              />
            </span>
          </summary>
          <div className="space-y-2">
            {tbd.map((r) => (
              <GameRow key={`${r.matchup.seriesLetter}-${r.game.gameNumber}`} row={r} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
