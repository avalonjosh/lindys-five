'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';

export interface CupOddsTeam {
  abbrev: string;
  name: string;
  logo: string;
  slug: string;
  cupOdds: number;
  currentRound: string;
  seriesStatus: string;
  isEliminated: boolean;
}

interface StanleyCupOddsTableProps {
  teams: CupOddsTeam[];
}

export default function StanleyCupOddsTable({ teams }: StanleyCupOddsTableProps) {
  const active = teams.filter(t => !t.isEliminated).sort((a, b) => b.cupOdds - a.cupOdds);
  const eliminated = teams.filter(t => t.isEliminated);
  const maxOdds = active[0]?.cupOdds || 1;

  return (
    <div className="space-y-6">
      {/* Active teams */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-0">
            <thead>
              <tr className="text-gray-500 text-xs uppercase border-b border-gray-200">
                <th className="text-left py-2 px-3 w-8">#</th>
                <th className="text-left py-2 px-2">Team</th>
                <th className="text-center py-2 px-2">Round</th>
                <th className="text-center py-2 px-2">Series</th>
                <th className="text-center py-2 px-2 font-bold text-gray-700">Cup Odds</th>
                <th className="py-2 px-2 w-32 hidden sm:table-cell" />
              </tr>
            </thead>
            <tbody>
              {active.map((team, idx) => {
                const barWidth = Math.max(4, (team.cupOdds / maxOdds) * 100);
                return (
                  <tr key={team.abbrev} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                    <td className="py-2.5 px-3 text-gray-400 text-xs font-medium">{idx + 1}</td>
                    <td className="py-2.5 px-2">
                      <Link href={team.slug ? `/nhl/${team.slug}` : '#'} className="flex items-center gap-2 group">
                        <img src={team.logo} alt={team.name} className="w-6 h-6 flex-shrink-0" loading="lazy" />
                        <span className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors truncate">
                          <span className="hidden md:inline">{team.name}</span>
                          <span className="md:hidden">{team.abbrev}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="py-2.5 px-2 text-center text-gray-500 text-xs">{team.currentRound}</td>
                    <td className="py-2.5 px-2 text-center text-gray-600 text-xs whitespace-nowrap">{team.seriesStatus}</td>
                    <td className={`py-2.5 px-2 text-center font-bold ${
                      team.cupOdds >= 15 ? 'text-emerald-600' : team.cupOdds >= 5 ? 'text-yellow-600' : 'text-red-500'
                    }`}>
                      {team.cupOdds.toFixed(1)}%
                    </td>
                    <td className="py-2.5 px-2 hidden sm:table-cell">
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Eliminated teams */}
      {eliminated.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              Eliminated ({eliminated.length})
            </h3>
          </div>
          <div className="divide-y divide-gray-50 px-4">
            {eliminated.map(team => (
              <div key={team.abbrev} className="flex items-center gap-3 py-2 opacity-50">
                <img src={team.logo} alt={team.name} className="w-5 h-5 object-contain grayscale" />
                <span className="text-sm text-gray-500">{team.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="text-center">
        <Link
          href="/playoffs"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          View Full Bracket
        </Link>
      </div>
    </div>
  );
}
