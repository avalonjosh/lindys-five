'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { StandingsTeam } from '@/lib/types/boxscore';
import type { NHLGame } from '@/lib/types';
import { TEAMS } from '@/lib/teamConfig';
import { fetchScoresByDate } from '@/lib/services/nhlApi';

const getTeamSlug = (abbrev: string): string | null => {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.slug || null;
};

interface StandingsSnapshotProps {
  standings: StandingsTeam[];
  homeAbbrev: string;
  awayAbbrev: string;
  gameDate: string;
  currentGameId: string;
}

function getTeamColor(abbrev: string): string {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.colors.primary ?? '#6b7280';
}

// Format start time in Eastern timezone
function formatStartTime(utcTime: string): string {
  const date = new Date(utcTime);
  return date.toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Get game status display for a team
function getGameStatusDisplay(
  game: NHLGame,
  teamAbbrev: string
): { text: string; isLive: boolean; score?: string } {
  const isHome = game.homeTeam.abbrev === teamAbbrev;
  const opponent = isHome ? game.awayTeam : game.homeTeam;
  const teamScore = isHome ? game.homeTeam.score : game.awayTeam.score;
  const opponentScore = isHome ? game.awayTeam.score : game.homeTeam.score;

  if (game.gameState === 'LIVE' || game.gameState === 'CRIT') {
    const period = game.periodDescriptor?.number || game.period;
    let periodText = '';
    if (game.periodDescriptor?.periodType === 'OT') {
      periodText = 'OT';
    } else if (game.periodDescriptor?.periodType === 'SO') {
      periodText = 'SO';
    } else if (period) {
      periodText = period === 1 ? '1st' : period === 2 ? '2nd' : period === 3 ? '3rd' : `${period}th`;
    }
    const timeText = game.clock?.inIntermission ? 'INT' : game.clock?.timeRemaining || '';
    return {
      text: `${teamAbbrev} ${teamScore}-${opponent.abbrev} ${opponentScore}`,
      isLive: true,
      score: `${periodText} ${timeText}`.trim(),
    };
  }

  if (game.gameState === 'FINAL' || game.gameState === 'OFF') {
    const periodType = game.gameOutcome?.lastPeriodType;
    const suffix = periodType === 'OT' ? '/OT' : periodType === 'SO' ? '/SO' : '';
    return {
      text: `${teamAbbrev} ${teamScore}-${opponent.abbrev} ${opponentScore}`,
      isLive: false,
      score: `F${suffix}`,
    };
  }

  // Future game
  const timeStr = game.startTimeUTC ? formatStartTime(game.startTimeUTC) : 'TBD';
  return {
    text: `${isHome ? 'vs' : '@'} ${opponent.abbrev}`,
    isLive: false,
    score: timeStr,
  };
}

export default function StandingsSnapshot({
  standings,
  homeAbbrev,
  awayAbbrev,
  gameDate,
  currentGameId,
}: StandingsSnapshotProps) {
  const [expanded, setExpanded] = useState(false);
  const [todayGames, setTodayGames] = useState<NHLGame[]>([]);

  // Fetch games for the game date when expanded
  const fetchGames = useCallback(async () => {
    try {
      const games = await fetchScoresByDate(gameDate);
      setTodayGames(games);
    } catch (err) {
      console.error('Error fetching games for standings:', err);
    }
  }, [gameDate]);

  useEffect(() => {
    if (expanded && todayGames.length === 0) {
      fetchGames();
    }
  }, [expanded, fetchGames, todayGames.length]);

  // Build game lookup by team abbreviation
  const gamesByTeam = useMemo(() => {
    const map = new Map<string, NHLGame>();
    todayGames.forEach(game => {
      map.set(game.homeTeam.abbrev, game);
      map.set(game.awayTeam.abbrev, game);
    });
    return map;
  }, [todayGames]);

  const raceData = useMemo(() => {
    if (!standings || standings.length === 0) return null;

    const homeTeam = standings.find(t => t.teamAbbrev.default === homeAbbrev);
    if (!homeTeam) return null;

    const conference = homeTeam.conferenceName;
    const confTeams = standings.filter(t => t.conferenceName === conference);

    // Get unique divisions in this conference
    const divisions = [...new Set(confTeams.map(t => t.divisionName))];

    // Top 3 from each division
    const getDivisionTop3 = (divName: string) =>
      confTeams
        .filter(t => t.divisionName === divName)
        .sort((a, b) => a.divisionSequence - b.divisionSequence)
        .slice(0, 3);

    // Wildcard teams: ranked 4+ in their division, sorted by points desc
    const wildcardTeams = confTeams
      .filter(t => t.divisionSequence > 3)
      .sort((a, b) => b.points - a.points || a.gamesPlayed - b.gamesPlayed);

    // Check if away team is in different conference
    const awayTeam = standings.find(t => t.teamAbbrev.default === awayAbbrev);
    const awayInDifferentConf = awayTeam && awayTeam.conferenceName !== conference;

    return { divisions, getDivisionTop3, wildcardTeams, conference, awayInDifferentConf, awayTeam };
  }, [standings, homeAbbrev, awayAbbrev]);

  if (!raceData) return null;

  const { divisions, getDivisionTop3, wildcardTeams, conference, awayInDifferentConf, awayTeam } = raceData;
  const accentColor = getTeamColor(homeAbbrev);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Collapsible header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-700">
            {conference} Conference Standings
          </h3>
          {!expanded && (
            <span className="text-xs text-gray-400">
              (Wild Card)
            </span>
          )}
        </div>
        <ChevronDown
          size={18}
          className={`transition-transform duration-200 text-gray-400 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expandable content */}
      {expanded && (
      <div className="overflow-hidden">
        <div className="border-t border-gray-100 py-3 overflow-x-auto">
          <div className="min-w-[360px] sm:min-w-[700px] space-y-4 px-2">
          {/* Division top-3 sections */}
          {divisions.map(divName => {
            const top3 = getDivisionTop3(divName);
            return (
              <div key={divName}>
                <h4 className="text-xs font-semibold text-gray-500 mb-1.5 px-2">
                  {divName}
                </h4>
                <TeamHeader hasGames={todayGames.length > 0} />
                <div className="space-y-0.5">
                  {top3.map((team, idx) => (
                    <TeamRow
                      key={team.teamAbbrev.default}
                      team={team}
                      rank={team.divisionSequence}
                      inPlayoffPosition
                      isHighlighted={team.teamAbbrev.default === homeAbbrev || team.teamAbbrev.default === awayAbbrev}
                      accentColor={accentColor}
                      game={gamesByTeam.get(team.teamAbbrev.default)}
                      hasGames={todayGames.length > 0}
                      currentGameId={currentGameId}
                      index={idx}
                    />
                  ))}
                </div>
              </div>
            );
          })}

          {/* Wild Card section */}
          {wildcardTeams.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-1.5 px-2">
                Wild Card
              </h4>
              <TeamHeader hasGames={todayGames.length > 0} />
              <div className="space-y-0.5">
                {wildcardTeams.map((team, idx) => (
                  <React.Fragment key={team.teamAbbrev.default}>
                    <TeamRow
                      team={team}
                      rank={idx + 1}
                      inPlayoffPosition={idx < 2}
                      isHighlighted={team.teamAbbrev.default === homeAbbrev || team.teamAbbrev.default === awayAbbrev}
                      accentColor={accentColor}
                      game={gamesByTeam.get(team.teamAbbrev.default)}
                      hasGames={todayGames.length > 0}
                      currentGameId={currentGameId}
                      index={idx}
                    />
                    {/* Playoff cut line after position 2 */}
                    {idx === 1 && wildcardTeams.length > 2 && (
                      <div className="my-1.5 mx-2 border-t-2 border-dashed border-red-300" />
                    )}
                  </React.Fragment>
                ))}
              </div>
              <div className="mt-1.5 px-2 text-[10px] text-gray-400">
                Top 2 make playoffs
              </div>
            </div>
          )}

          {/* Away team in different conference */}
          {awayInDifferentConf && awayTeam && (
            <div className="px-2 py-2 bg-gray-50 rounded-lg">
              <p className="text-xs font-semibold text-gray-500 mb-1">
                {awayTeam.conferenceName} Conference
              </p>
              <div className="flex items-center gap-2">
                <span
                  className="w-0.5 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: getTeamColor(awayAbbrev) }}
                />
                <img src={awayTeam.teamLogo} alt={awayAbbrev} className="w-5 h-5" />
                <span className="text-sm font-semibold text-gray-900">{awayAbbrev}</span>
                <span className="text-xs text-gray-400 tabular-nums">
                  {awayTeam.wins}-{awayTeam.losses}-{awayTeam.otLosses}
                </span>
                <span className="ml-auto text-sm font-semibold tabular-nums">{awayTeam.points} PTS</span>
                <span className="text-xs text-gray-400">
                  #{awayTeam.conferenceSequence} in {awayTeam.conferenceName}
                </span>
              </div>
            </div>
          )}
          </div>
        </div>
      </div>
      )}
    </div>
  );
}

// Column header - matches StandingsCard ScoresHeader layout
function TeamHeader({ hasGames }: { hasGames: boolean }) {
  return (
    <div className="flex items-center gap-2 lg:gap-4 px-2 pb-1 text-xs font-medium text-gray-400" style={{ borderLeft: '3px solid transparent' }}>
      <span className="w-5 text-center">#</span>
      <span className="w-6" />
      <span className="w-10 lg:w-12">Team</span>
      {/* W/L/OT hidden on mobile when scores are shown */}
      <span className="hidden lg:block w-8 text-right">W</span>
      <span className="hidden lg:block w-8 text-right">L</span>
      <span className="hidden lg:block w-8 text-right">OT</span>
      {/* Desktop-only stat columns */}
      <span className="hidden lg:block w-10 text-right">RW</span>
      <span className="hidden lg:block w-12 text-right">ROW</span>
      <span className="hidden lg:block w-20 text-right">HOME</span>
      <span className="hidden lg:block w-20 text-right">AWAY</span>
      <span className="hidden lg:block w-10 text-right">GF</span>
      <span className="hidden lg:block w-10 text-right">GA</span>
      <span className="hidden lg:block w-12 text-right">DIFF</span>
      <span className="hidden lg:block w-20 text-right">L10</span>
      <span className="hidden lg:block w-12 text-right">STRK</span>
      <span className="flex-1" />
      <span className="w-6 lg:w-10 text-right">GP</span>
      <span className="w-8 lg:w-10 text-right">PTS</span>
      <span className="w-10 lg:w-12 text-right">P%</span>
      {hasGames && (
        <span className="w-28 lg:w-28 text-center">Tonight</span>
      )}
    </div>
  );
}

// Team row - matches StandingsCard ScoresRow layout
function TeamRow({
  team,
  rank,
  inPlayoffPosition,
  isHighlighted,
  accentColor,
  game,
  hasGames,
  currentGameId,
  index,
}: {
  team: StandingsTeam;
  rank: number;
  inPlayoffPosition: boolean;
  isHighlighted: boolean;
  accentColor: string;
  game?: NHLGame;
  hasGames: boolean;
  currentGameId: string;
  index: number;
}) {
  const gameStatus = game ? getGameStatusDisplay(game, team.teamAbbrev.default) : null;
  const zebraClass = index % 2 === 1 ? 'bg-gray-100/50' : '';
  const diff = team.goalDifferential || 0;

  return (
    <div
      className={`flex items-center gap-2 lg:gap-4 py-1.5 px-2 rounded-lg transition-colors ${
        isHighlighted ? 'bg-blue-50' : zebraClass
      }`}
      style={{
        borderLeft: `3px solid ${isHighlighted ? accentColor : 'transparent'}`,
      }}
    >
      {/* Rank */}
      <span
        className={`w-5 text-center text-sm tabular-nums ${
          inPlayoffPosition ? 'font-bold text-gray-800' : 'font-normal text-gray-400'
        }`}
      >
        {rank}
      </span>

      {/* Logo */}
      {(() => {
        const slug = getTeamSlug(team.teamAbbrev.default);
        const img = <img src={team.teamLogo} alt={team.teamAbbrev.default} className="w-6 h-6 object-contain" />;
        return slug ? (
          <Link href={`/${slug}`} className="flex-shrink-0 hover:scale-110 transition-transform" onClick={(e) => e.stopPropagation()}>
            {img}
          </Link>
        ) : img;
      })()}

      {/* Abbrev */}
      <span
        className={`w-10 lg:w-12 text-sm font-semibold ${
          isHighlighted ? '' : 'text-gray-700'
        }`}
        style={isHighlighted ? { color: accentColor } : undefined}
      >
        {team.teamAbbrev.default}
      </span>

      {/* W - hidden on mobile */}
      <span className="hidden lg:block w-8 text-right text-xs tabular-nums text-gray-500">
        {team.wins}
      </span>

      {/* L - hidden on mobile */}
      <span className="hidden lg:block w-8 text-right text-xs tabular-nums text-gray-500">
        {team.losses}
      </span>

      {/* OT - hidden on mobile */}
      <span className="hidden lg:block w-8 text-right text-xs tabular-nums text-gray-500">
        {team.otLosses}
      </span>

      {/* Desktop-only stat columns */}
      {/* Regulation Wins */}
      <span className="hidden lg:block w-10 text-right text-xs tabular-nums text-gray-500">
        {team.regulationWins}
      </span>

      {/* Regulation + OT Wins */}
      <span className="hidden lg:block w-12 text-right text-xs tabular-nums text-gray-500">
        {team.regulationPlusOtWins}
      </span>

      {/* Home Record */}
      <span className="hidden lg:block w-20 text-right text-xs tabular-nums text-gray-500">
        {team.homeWins}-{team.homeLosses}-{team.homeOtLosses}
      </span>

      {/* Away Record */}
      <span className="hidden lg:block w-20 text-right text-xs tabular-nums text-gray-500">
        {team.roadWins}-{team.roadLosses}-{team.roadOtLosses}
      </span>

      {/* Goals For */}
      <span className="hidden lg:block w-10 text-right text-xs tabular-nums text-gray-500">
        {team.goalFor}
      </span>

      {/* Goals Against */}
      <span className="hidden lg:block w-10 text-right text-xs tabular-nums text-gray-500">
        {team.goalAgainst}
      </span>

      {/* Goal Differential */}
      <span className="hidden lg:block w-12 text-right text-xs tabular-nums text-gray-500">
        {diff > 0 ? '+' : ''}{diff}
      </span>

      {/* L10 */}
      <span className="hidden lg:block w-20 text-right text-xs tabular-nums text-gray-500">
        {team.l10Wins}-{team.l10Losses}-{team.l10OtLosses}
      </span>

      {/* Streak */}
      <span className="hidden lg:block w-12 text-right text-xs tabular-nums text-gray-500">
        {team.streakCode ? `${team.streakCode}${team.streakCount || ''}` : '-'}
      </span>

      {/* Spacer */}
      <span className="flex-1" />

      {/* GP */}
      <span className="w-6 lg:w-10 text-right text-xs tabular-nums text-gray-400">
        {team.gamesPlayed}
      </span>

      {/* PTS */}
      <span
        className={`w-8 lg:w-10 text-right text-sm font-bold tabular-nums ${
          isHighlighted ? '' : 'text-gray-800'
        }`}
        style={isHighlighted ? { color: accentColor } : undefined}
      >
        {team.points}
      </span>

      {/* P% */}
      <span className="w-10 lg:w-12 text-right text-xs tabular-nums text-gray-500">
        .{Math.round(team.pointPctg * 1000).toString().padStart(3, '0')}
      </span>

      {/* Tonight's game - always render cell when games exist to keep columns aligned */}
      {hasGames && (
        <div className="w-28 lg:w-28 flex flex-col items-center">
          {gameStatus && game ? (() => {
            const isCurrentGame = String(game.id) === currentGameId;
            const isClickable = !isCurrentGame;
            const content = (
              <>
                <span className={`text-[10px] tabular-nums leading-tight ${
                  gameStatus.isLive ? 'text-red-500 font-semibold' : 'text-gray-600'
                }`}>
                  {gameStatus.text}
                </span>
                {gameStatus.score && (
                  <span className={`text-[9px] leading-tight ${
                    gameStatus.isLive ? 'text-red-400' : 'text-gray-400'
                  }`}>
                    {gameStatus.score}
                  </span>
                )}
              </>
            );
            if (isClickable) {
              return (
                <Link
                  href={`/scores/${game.id}`}
                  className="flex flex-col items-center hover:underline"
                >
                  {content}
                </Link>
              );
            }
            return content;
          })() : (
            <span className="text-[10px] text-gray-300">&mdash;</span>
          )}
        </div>
      )}
    </div>
  );
}
