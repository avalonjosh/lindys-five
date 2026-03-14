'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';

interface TeamPlayoffStatusProps {
  teamAbbrev: string;
  teamName: string;
  primaryColor: string;
}

interface SeriesData {
  roundLabel: string;
  oppAbbrev: string;
  oppName: string;
  oppLogo: string;
  teamWins: number;
  oppWins: number;
  teamIsTop: boolean;
  teamPtPctg: number;
  oppPtPctg: number;
  isEliminated: boolean;
  seriesComplete: boolean;
  teamWonSeries: boolean;
}

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Stanley Cup Final',
};

export default function TeamPlayoffStatus({ teamAbbrev, teamName, primaryColor }: TeamPlayoffStatusProps) {
  const [series, setSeries] = useState<SeriesData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const res = await fetch('/api/playoffs/bracket');
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        if (!data.bracket?.rounds) { setLoading(false); return; }

        const standingsMap = new Map<string, any>();
        for (const st of data.standings || []) {
          standingsMap.set(st.teamAbbrev.default, st);
        }

        for (const round of data.bracket.rounds) {
          for (const s of round.series || []) {
            const teams = s.matchupTeams || [];
            const myTeam = teams.find((t: any) => t.team.abbrev === teamAbbrev);
            if (!myTeam) continue;

            const oppTeam = teams.find((t: any) => t.team.abbrev !== teamAbbrev);
            if (!oppTeam) continue;

            const teamIsTop = !!myTeam.seed?.isTop;
            const teamWins = teamIsTop ? (s.topSeedWins || 0) : (s.bottomSeedWins || 0);
            const oppWins = teamIsTop ? (s.bottomSeedWins || 0) : (s.topSeedWins || 0);
            const teamStanding = standingsMap.get(teamAbbrev);
            const oppStanding = standingsMap.get(oppTeam.team.abbrev);

            setSeries({
              roundLabel: ROUND_LABELS[round.roundNumber] || `Round ${round.roundNumber}`,
              oppAbbrev: oppTeam.team.abbrev,
              oppName: oppTeam.team.commonName?.default || oppTeam.team.name?.default || oppTeam.team.abbrev,
              oppLogo: oppTeam.team.logo,
              teamWins,
              oppWins,
              teamIsTop,
              teamPtPctg: teamStanding?.pointPctg || 0.5,
              oppPtPctg: oppStanding?.pointPctg || 0.5,
              isEliminated: oppWins >= 4,
              seriesComplete: teamWins >= 4 || oppWins >= 4,
              teamWonSeries: teamWins >= 4,
            });
            break;
          }
        }
      } catch {
        // Silent fail
      }
      setLoading(false);
    }
    fetchStatus();
  }, [teamAbbrev]);

  if (loading || !series) return null;

  const seriesWinPct = series.seriesComplete
    ? (series.teamWonSeries ? 100 : 0)
    : Math.round(computeSeriesWinProbability(
        series.teamPtPctg, series.oppPtPctg,
        series.teamIsTop ? series.teamWins : series.oppWins,
        series.teamIsTop ? series.oppWins : series.teamWins,
        series.teamIsTop
      ));

  const actualTeamPct = series.teamIsTop ? seriesWinPct : 100 - seriesWinPct;

  if (series.isEliminated) {
    return (
      <div className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3 mx-4 mt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-600">
              Eliminated in {series.roundLabel}
            </p>
            <p className="text-xs text-gray-500">
              Lost to {series.oppName} {series.oppWins}-{series.teamWins}
            </p>
          </div>
          <Link href="/playoffs" className="text-xs text-blue-600 hover:text-blue-500 font-medium">
            View Bracket &rarr;
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg px-4 py-3 mx-4 mt-3 border" style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }}>
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-semibold" style={{ color: primaryColor }}>
          {series.roundLabel}
        </p>
        <Link href="/playoffs" className="text-xs text-blue-600 hover:text-blue-500 font-medium">
          View Bracket &rarr;
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <span className="text-sm font-bold text-gray-900">{teamName}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < series.teamWins ? 'bg-emerald-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
        </div>
        <span className="text-xs font-semibold text-gray-400">vs</span>
        <div className="flex items-center gap-2 flex-1 justify-end">
          <div className="flex gap-0.5">
            {Array.from({ length: 4 }, (_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full ${i < series.oppWins ? 'bg-emerald-500' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <img src={series.oppLogo} alt={series.oppName} className="w-6 h-6" />
          <span className="text-sm font-bold text-gray-900">{series.oppAbbrev}</span>
        </div>
      </div>
      {!series.seriesComplete && (
        <p className="text-xs text-gray-500 mt-2">
          Win series: {actualTeamPct}%
        </p>
      )}
    </div>
  );
}
