'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { StanleyCupOddsEntry } from '@/lib/types/playoffs';

interface StanleyCupOddsProps {
  odds: StanleyCupOddsEntry[];
}

const getTeamSlug = (abbrev: string): string => {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.slug || '';
};

export default function StanleyCupOdds({ odds }: StanleyCupOddsProps) {
  const activeTeams = odds.filter(t => !t.isEliminated).sort((a, b) => b.cupOdds - a.cupOdds);
  const eliminatedTeams = odds.filter(t => t.isEliminated);
  const maxOdds = activeTeams[0]?.cupOdds || 1;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#003087' }}>
        <h2
          className="text-xl md:text-2xl font-bold text-white"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          Stanley Cup Odds
        </h2>
        <p className="text-xs text-white/70 uppercase tracking-wider">
          Probability of winning the Cup
        </p>
      </div>

      <div className="divide-y divide-gray-100">
        {activeTeams.map((team, idx) => {
          const slug = getTeamSlug(team.abbrev);
          const barWidth = Math.max(2, (team.cupOdds / maxOdds) * 100);

          return (
            <Link
              key={team.abbrev}
              href={slug ? `/nhl/${slug}` : '#'}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50/50 transition-colors"
            >
              <span className="w-5 text-xs text-gray-400 font-medium text-right">
                {idx + 1}
              </span>
              <img src={team.logo} alt={team.abbrev} className="w-7 h-7 object-contain" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    <span className="hidden sm:inline">{team.name}</span>
                    <span className="sm:hidden">{team.abbrev}</span>
                  </span>
                  <span className="text-xs text-gray-400">({team.seed})</span>
                </div>
                <div className="mt-0.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
              </div>
              <span className={`text-sm font-bold tabular-nums ${
                team.cupOdds >= 15 ? 'text-emerald-600' : team.cupOdds >= 5 ? 'text-yellow-600' : 'text-gray-500'
              }`}>
                {team.cupOdds.toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>

      {/* Eliminated teams */}
      {eliminatedTeams.length > 0 && (
        <>
          <div className="px-4 py-2 bg-gray-50 border-t border-gray-200">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Eliminated
            </span>
          </div>
          <div className="divide-y divide-gray-50">
            {eliminatedTeams.map(team => (
              <div
                key={team.abbrev}
                className="flex items-center gap-3 px-4 py-2 opacity-40"
              >
                <span className="w-5" />
                <img src={team.logo} alt={team.abbrev} className="w-6 h-6 object-contain grayscale" />
                <span className="text-sm text-gray-500">{team.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
