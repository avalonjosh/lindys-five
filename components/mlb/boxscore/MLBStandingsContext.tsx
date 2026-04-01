'use client';

import { useState, useEffect } from 'react';
import type { MLBStandingsTeam } from '@/lib/types/mlb';
import { fetchMLBStandings } from '@/lib/services/mlbApi';

const SHORT_DIVISION: Record<string, string> = {
  'American League East': 'AL East',
  'American League Central': 'AL Central',
  'American League West': 'AL West',
  'National League East': 'NL East',
  'National League Central': 'NL Central',
  'National League West': 'NL West',
};

interface Props {
  awayAbbrev: string;
  homeAbbrev: string;
  awayLogo: string;
  homeLogo: string;
}

function TeamStanding({ team, logo }: { team: MLBStandingsTeam | undefined; logo: string }) {
  if (!team) return <div className="flex-1 text-center text-sm text-gray-400">—</div>;
  const shortDiv = SHORT_DIVISION[team.division] || team.division;
  const suffix = team.divisionRank === 1 ? 'st' : team.divisionRank === 2 ? 'nd' : team.divisionRank === 3 ? 'rd' : 'th';

  return (
    <div className="flex-1 text-center">
      <img src={logo} alt={team.teamAbbrev} className="w-8 h-8 mx-auto mb-1" />
      <div className="text-sm font-bold text-gray-900">{team.teamAbbrev}</div>
      <div className="text-lg font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
        {team.divisionRank}{suffix} in {shortDiv}
      </div>
      <div className="text-xs text-gray-500">{team.wins}-{team.losses} ({(team.winPct * 100).toFixed(1)}%)</div>
      {team.gamesBack > 0 && (
        <div className="text-xs text-gray-400">{team.gamesBack.toFixed(1)} GB</div>
      )}
    </div>
  );
}

export default function MLBStandingsContext({ awayAbbrev, homeAbbrev, awayLogo, homeLogo }: Props) {
  const [standings, setStandings] = useState<MLBStandingsTeam[]>([]);

  useEffect(() => {
    fetchMLBStandings().then(setStandings).catch(() => {});
  }, []);

  const awayTeam = standings.find(s => s.teamAbbrev === awayAbbrev);
  const homeTeam = standings.find(s => s.teamAbbrev === homeAbbrev);

  if (standings.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 p-4 md:p-6">
      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center">Standings</h3>
      <div className="flex items-start gap-4">
        <TeamStanding team={awayTeam} logo={awayLogo} />
        <div className="text-xl font-light text-gray-300 pt-6">vs</div>
        <TeamStanding team={homeTeam} logo={homeLogo} />
      </div>
    </div>
  );
}
