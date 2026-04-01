'use client';

import { useState, useEffect } from 'react';
import type { MLBTeamSeasonStats } from '@/lib/types/mlb';
import { fetchTeamSeasonStats } from '@/lib/services/mlbApi';

interface Props {
  awayTeamId: number;
  homeTeamId: number;
  awayAbbrev: string;
  homeAbbrev: string;
}

function StatBar({ label, awayValue, homeValue, awayDisplay, homeDisplay, higherIsBetter = true }: {
  label: string;
  awayValue: number;
  homeValue: number;
  awayDisplay: string;
  homeDisplay: string;
  higherIsBetter?: boolean;
}) {
  const total = awayValue + homeValue || 1;
  const awayPct = (awayValue / total) * 100;
  const awayBetter = higherIsBetter ? awayValue > homeValue : awayValue < homeValue;
  const homeBetter = higherIsBetter ? homeValue > awayValue : homeValue < awayValue;

  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs mb-1">
        <span className={`font-semibold ${awayBetter ? 'text-gray-900' : 'text-gray-400'}`}>{awayDisplay}</span>
        <span className="font-medium text-gray-500">{label}</span>
        <span className={`font-semibold ${homeBetter ? 'text-gray-900' : 'text-gray-400'}`}>{homeDisplay}</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden bg-gray-100">
        <div className="bg-blue-500 rounded-l-full transition-all" style={{ width: `${awayPct}%` }} />
        <div className="bg-red-500 rounded-r-full transition-all" style={{ width: `${100 - awayPct}%` }} />
      </div>
    </div>
  );
}

export default function MLBTeamComparison({ awayTeamId, homeTeamId, awayAbbrev, homeAbbrev }: Props) {
  const [awayStats, setAwayStats] = useState<MLBTeamSeasonStats | null>(null);
  const [homeStats, setHomeStats] = useState<MLBTeamSeasonStats | null>(null);

  useEffect(() => {
    const season = new Date().getFullYear();
    fetchTeamSeasonStats(awayTeamId, season).then(setAwayStats);
    fetchTeamSeasonStats(homeTeamId, season).then(setHomeStats);
  }, [awayTeamId, homeTeamId]);

  if (!awayStats || !homeStats) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 md:p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4">Team Comparison</h3>
      <div className="flex justify-between text-sm font-bold text-gray-700 mb-3">
        <span>{awayAbbrev}</span>
        <span>{homeAbbrev}</span>
      </div>

      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2">Hitting</div>
      <StatBar label="AVG" awayValue={parseFloat(awayStats.batting.avg)} homeValue={parseFloat(homeStats.batting.avg)} awayDisplay={awayStats.batting.avg} homeDisplay={homeStats.batting.avg} />
      <StatBar label="OPS" awayValue={parseFloat(awayStats.batting.ops)} homeValue={parseFloat(homeStats.batting.ops)} awayDisplay={awayStats.batting.ops} homeDisplay={homeStats.batting.ops} />
      <StatBar label="HR" awayValue={awayStats.batting.hr} homeValue={homeStats.batting.hr} awayDisplay={String(awayStats.batting.hr)} homeDisplay={String(homeStats.batting.hr)} />
      <StatBar label="R/G" awayValue={parseFloat(awayStats.batting.runsPerGame)} homeValue={parseFloat(homeStats.batting.runsPerGame)} awayDisplay={awayStats.batting.runsPerGame} homeDisplay={homeStats.batting.runsPerGame} />

      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold mb-2 mt-4">Pitching</div>
      <StatBar label="ERA" awayValue={parseFloat(awayStats.pitching.era)} homeValue={parseFloat(homeStats.pitching.era)} awayDisplay={awayStats.pitching.era} homeDisplay={homeStats.pitching.era} higherIsBetter={false} />
      <StatBar label="WHIP" awayValue={parseFloat(awayStats.pitching.whip)} homeValue={parseFloat(homeStats.pitching.whip)} awayDisplay={awayStats.pitching.whip} homeDisplay={homeStats.pitching.whip} higherIsBetter={false} />
      <StatBar label="SO/9" awayValue={parseFloat(awayStats.pitching.soPerNine)} homeValue={parseFloat(homeStats.pitching.soPerNine)} awayDisplay={awayStats.pitching.soPerNine} homeDisplay={homeStats.pitching.soPerNine} />
    </div>
  );
}
