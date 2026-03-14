'use client';

import type { StandingsTeam } from '@/lib/types/boxscore';
import { TEAMS } from '@/lib/teamConfig';
import { getDivCutLine, getWcCutLine, computeProb } from '@/lib/utils/standingsCalc';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';

interface PlayoffImpactProps {
  homeTeam: { id: number; abbrev: string; score: number; logo: string; commonName: { default: string } };
  awayTeam: { id: number; abbrev: string; score: number; logo: string; commonName: { default: string } };
  standings: StandingsTeam[];
  gameState: string;
  gameOutcome?: { lastPeriodType: string };
  gameType?: number;
  seriesStatus?: { topSeedAbbrev: string; topSeedWins: number; bottomSeedWins: number };
}

interface TeamImpact {
  abbrev: string;
  name: string;
  logo: string;
  beforeProb: number;
  afterProb: number;
  delta: number;
}

interface TeamScenario {
  abbrev: string;
  name: string;
  logo: string;
  currentProb: number;
  winProb: number;
  winDelta: number;
  lossProb: number;
  lossDelta: number;
}


function DeltaBadge({ delta }: { delta: number }) {
  if (delta > 0) {
    return (
      <span className="text-xs font-semibold text-green-600 flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
        +{delta}%
      </span>
    );
  }
  if (delta < 0) {
    return (
      <span className="text-xs font-semibold text-red-600 flex items-center gap-0.5">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
        {delta}%
      </span>
    );
  }
  return <span className="text-xs font-semibold text-gray-400">0%</span>;
}

export default function PlayoffImpact({
  homeTeam,
  awayTeam,
  standings,
  gameState,
  gameOutcome,
  gameType,
  seriesStatus,
}: PlayoffImpactProps) {
  if (!standings || standings.length === 0) return null;

  const isFinal = gameState === 'FINAL' || gameState === 'OFF';
  const isLive = gameState === 'LIVE' || gameState === 'CRIT';
  const isFuture = gameState === 'FUT' || gameState === 'PRE';

  if (!isFinal && !isLive && !isFuture) return null;

  const homeStanding = standings.find(t => t.teamAbbrev.default === homeTeam.abbrev);
  const awayStanding = standings.find(t => t.teamAbbrev.default === awayTeam.abbrev);

  if (!homeStanding || !awayStanding) return null;

  // Playoff games: show series win probability impact instead of standings impact
  if (gameType === 3 && seriesStatus) {
    try {
      return (
        <SeriesImpact
          homeTeam={homeTeam}
          awayTeam={awayTeam}
          homeStanding={homeStanding}
          awayStanding={awayStanding}
          gameState={gameState}
          seriesStatus={seriesStatus}
        />
      );
    } catch {
      return null;
    }
  }

  try {
    if (isFinal) {
      return <FinalImpact homeTeam={homeTeam} awayTeam={awayTeam} homeStanding={homeStanding} awayStanding={awayStanding} standings={standings} gameOutcome={gameOutcome} />;
    }
    // LIVE and FUT/PRE games both show win/loss scenarios
    return <LiveImpact homeTeam={homeTeam} awayTeam={awayTeam} homeStanding={homeStanding} awayStanding={awayStanding} standings={standings} />;
  } catch {
    return null;
  }
}

// FINAL game: show actual result impact
function FinalImpact({
  homeTeam,
  awayTeam,
  homeStanding,
  awayStanding,
  standings,
  gameOutcome,
}: {
  homeTeam: PlayoffImpactProps['homeTeam'];
  awayTeam: PlayoffImpactProps['awayTeam'];
  homeStanding: StandingsTeam;
  awayStanding: StandingsTeam;
  standings: StandingsTeam[];
  gameOutcome?: { lastPeriodType: string };
}) {
  const isOT = gameOutcome?.lastPeriodType === 'OT' || gameOutcome?.lastPeriodType === 'SO';
  const homeWon = homeTeam.score > awayTeam.score;

  function getPointsToSubtract(side: 'home' | 'away'): number {
    const won = side === 'home' ? homeWon : !homeWon;
    if (won) return 2;
    if (isOT) return 1;
    return 0;
  }

  const impacts: TeamImpact[] = [];

  for (const { standing, teamInfo, side } of [
    { standing: homeStanding, teamInfo: homeTeam, side: 'home' as const },
    { standing: awayStanding, teamInfo: awayTeam, side: 'away' as const },
  ]) {
    const divCutLine = getDivCutLine(standing, standings);
    const wcCutLine = getWcCutLine(standing, standings);

    const afterProb = computeProb(
      standing.points,
      standing.gamesPlayed,
      divCutLine,
      wcCutLine,
      standing,
      standings
    );

    const pointsToSubtract = getPointsToSubtract(side);
    const beforePoints = standing.points - pointsToSubtract;
    const beforeGP = standing.gamesPlayed - 1;

    if (beforeGP <= 0) continue;

    const beforeProb = computeProb(
      beforePoints,
      beforeGP,
      divCutLine,
      wcCutLine,
      standing,
      standings
    );

    const teamConfig = Object.values(TEAMS).find(t => t.abbreviation === teamInfo.abbrev);
    const displayName = teamConfig?.name || teamInfo.commonName.default;

    impacts.push({
      abbrev: teamInfo.abbrev,
      name: displayName,
      logo: teamInfo.logo,
      beforeProb,
      afterProb,
      delta: afterProb - beforeProb,
    });
  }

  if (impacts.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Playoff Impact</h3>
      </div>

      <div className="space-y-3">
        {impacts.map(team => (
          <div key={team.abbrev} className="flex items-center gap-3">
            <img src={team.logo} alt={team.name} className="w-7 h-7 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-800 truncate">{team.name}</p>
              <p className="text-xs text-gray-500">
                {team.beforeProb}%
                <span className="mx-1">&rarr;</span>
                {team.afterProb}%
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <DeltaBadge delta={team.delta} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// LIVE game: show win/loss scenarios
function LiveImpact({
  homeTeam,
  awayTeam,
  homeStanding,
  awayStanding,
  standings,
}: {
  homeTeam: PlayoffImpactProps['homeTeam'];
  awayTeam: PlayoffImpactProps['awayTeam'];
  homeStanding: StandingsTeam;
  awayStanding: StandingsTeam;
  standings: StandingsTeam[];
}) {
  const scenarios: TeamScenario[] = [];

  for (const { standing, teamInfo } of [
    { standing: homeStanding, teamInfo: homeTeam },
    { standing: awayStanding, teamInfo: awayTeam },
  ]) {
    const divCutLine = getDivCutLine(standing, standings);
    const wcCutLine = getWcCutLine(standing, standings);

    // Current probability (before tonight's game result)
    const currentProb = computeProb(
      standing.points,
      standing.gamesPlayed,
      divCutLine,
      wcCutLine,
      standing,
      standings
    );

    // If this team wins (+2 pts, +1 GP)
    const winProb = computeProb(
      standing.points + 2,
      standing.gamesPlayed + 1,
      divCutLine,
      wcCutLine,
      standing,
      standings
    );

    // If this team loses (+0 pts, +1 GP)
    const lossProb = computeProb(
      standing.points,
      standing.gamesPlayed + 1,
      divCutLine,
      wcCutLine,
      standing,
      standings
    );

    const teamConfig = Object.values(TEAMS).find(t => t.abbreviation === teamInfo.abbrev);
    const displayName = teamConfig?.name || teamInfo.commonName.default;

    scenarios.push({
      abbrev: teamInfo.abbrev,
      name: displayName,
      logo: teamInfo.logo,
      currentProb,
      winProb,
      winDelta: winProb - currentProb,
      lossProb,
      lossDelta: lossProb - currentProb,
    });
  }

  if (scenarios.length === 0) return null;

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">What&apos;s at Stake</h3>
      </div>

      <div className="space-y-4">
        {scenarios.map(team => (
          <div key={team.abbrev}>
            <div className="flex items-center gap-2 mb-2">
              <img src={team.logo} alt={team.name} className="w-6 h-6 flex-shrink-0" />
              <p className="text-xs font-medium text-gray-800">{team.name}</p>
              <span className="text-xs text-gray-400 ml-auto">Current: {team.currentProb}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {/* Win scenario */}
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Win</p>
                  <p className="text-xs text-gray-600">
                    {team.currentProb}%
                    <span className="mx-0.5">&rarr;</span>
                    {team.winProb}%
                  </p>
                </div>
                <DeltaBadge delta={team.winDelta} />
              </div>
              {/* Loss scenario */}
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Loss</p>
                  <p className="text-xs text-gray-600">
                    {team.currentProb}%
                    <span className="mx-0.5">&rarr;</span>
                    {team.lossProb}%
                  </p>
                </div>
                <DeltaBadge delta={team.lossDelta} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// PLAYOFF game: show series win probability shift
function SeriesImpact({
  homeTeam,
  awayTeam,
  homeStanding,
  awayStanding,
  gameState,
  seriesStatus,
}: {
  homeTeam: PlayoffImpactProps['homeTeam'];
  awayTeam: PlayoffImpactProps['awayTeam'];
  homeStanding: StandingsTeam;
  awayStanding: StandingsTeam;
  gameState: string;
  seriesStatus: { topSeedAbbrev: string; topSeedWins: number; bottomSeedWins: number };
}) {
  const isFinal = gameState === 'FINAL' || gameState === 'OFF';
  const homeIsTop = homeTeam.abbrev === seriesStatus.topSeedAbbrev;
  const topStanding = homeIsTop ? homeStanding : awayStanding;
  const bottomStanding = homeIsTop ? awayStanding : homeStanding;

  const { topSeedWins, bottomSeedWins } = seriesStatus;

  // Current series win probability
  const currentTopPct = computeSeriesWinProbability(
    topStanding.pointPctg, bottomStanding.pointPctg,
    topSeedWins, bottomSeedWins, true
  );

  if (isFinal) {
    // For final games, show before/after probability
    const homeWon = homeTeam.score > awayTeam.score;
    const prevTopWins = homeIsTop
      ? (homeWon ? topSeedWins - 1 : topSeedWins)
      : (homeWon ? topSeedWins : topSeedWins - 1);
    const prevBottomWins = homeIsTop
      ? (homeWon ? bottomSeedWins : bottomSeedWins - 1)
      : (homeWon ? bottomSeedWins - 1 : bottomSeedWins);

    const beforeTopPct = prevTopWins >= 0 && prevBottomWins >= 0
      ? computeSeriesWinProbability(
          topStanding.pointPctg, bottomStanding.pointPctg,
          prevTopWins, prevBottomWins, true
        )
      : 50;

    const teams = [
      { abbrev: homeTeam.abbrev, name: getTeamName(homeTeam), logo: homeTeam.logo,
        before: homeIsTop ? beforeTopPct : 100 - beforeTopPct,
        after: homeIsTop ? currentTopPct : 100 - currentTopPct },
      { abbrev: awayTeam.abbrev, name: getTeamName(awayTeam), logo: awayTeam.logo,
        before: homeIsTop ? 100 - beforeTopPct : beforeTopPct,
        after: homeIsTop ? 100 - currentTopPct : currentTopPct },
    ];

    return (
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex items-center gap-2 mb-1">
          <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">Series Impact</h3>
        </div>
        <p className="text-xs text-gray-400 mb-3">
          Series: {topSeedWins}-{bottomSeedWins}
        </p>
        <div className="space-y-3">
          {teams.map(t => (
            <div key={t.abbrev} className="flex items-center gap-3">
              <img src={t.logo} alt={t.name} className="w-7 h-7 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-800 truncate">{t.name}</p>
                <p className="text-xs text-gray-500">
                  {Math.round(t.before)}% <span className="mx-1">&rarr;</span> {Math.round(t.after)}%
                </p>
              </div>
              <DeltaBadge delta={Math.round(t.after - t.before)} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Live/Future: show win/loss scenarios
  const topWinPct = computeSeriesWinProbability(
    topStanding.pointPctg, bottomStanding.pointPctg,
    topSeedWins + 1, bottomSeedWins, true
  );
  const topLossPct = computeSeriesWinProbability(
    topStanding.pointPctg, bottomStanding.pointPctg,
    topSeedWins, bottomSeedWins + 1, true
  );

  const scenarios = [
    { abbrev: homeTeam.abbrev, name: getTeamName(homeTeam), logo: homeTeam.logo,
      current: homeIsTop ? currentTopPct : 100 - currentTopPct,
      winPct: homeIsTop ? topWinPct : 100 - topLossPct,
      lossPct: homeIsTop ? topLossPct : 100 - topWinPct },
    { abbrev: awayTeam.abbrev, name: getTeamName(awayTeam), logo: awayTeam.logo,
      current: homeIsTop ? 100 - currentTopPct : currentTopPct,
      winPct: homeIsTop ? 100 - topLossPct : topWinPct,
      lossPct: homeIsTop ? 100 - topWinPct : topLossPct },
  ];

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Series Stakes</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">
        Series: {topSeedWins}-{bottomSeedWins}
      </p>
      <div className="space-y-4">
        {scenarios.map(t => (
          <div key={t.abbrev}>
            <div className="flex items-center gap-2 mb-2">
              <img src={t.logo} alt={t.name} className="w-6 h-6 flex-shrink-0" />
              <p className="text-xs font-medium text-gray-800">{t.name}</p>
              <span className="text-xs text-gray-400 ml-auto">Win series: {Math.round(t.current)}%</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide">Win</p>
                  <p className="text-xs text-gray-600">
                    {Math.round(t.current)}%
                    <span className="mx-0.5">&rarr;</span>
                    {Math.round(t.winPct)}%
                  </p>
                </div>
                <DeltaBadge delta={Math.round(t.winPct - t.current)} />
              </div>
              <div className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wide">Loss</p>
                  <p className="text-xs text-gray-600">
                    {Math.round(t.current)}%
                    <span className="mx-0.5">&rarr;</span>
                    {Math.round(t.lossPct)}%
                  </p>
                </div>
                <DeltaBadge delta={Math.round(t.lossPct - t.current)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getTeamName(team: { abbrev: string; commonName: { default: string } }): string {
  const teamConfig = Object.values(TEAMS).find(t => t.abbreviation === team.abbrev);
  return teamConfig?.name || team.commonName.default;
}
