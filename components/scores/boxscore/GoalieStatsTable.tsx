'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { BoxscoreGoalie } from '@/lib/types/boxscore';

interface GoalieStatsTableProps {
  homeGoalies: BoxscoreGoalie[];
  awayGoalies: BoxscoreGoalie[];
  homeAbbrev: string;
  awayAbbrev: string;
  homeLogo: string;
  awayLogo: string;
}

interface ParsedGoalie extends BoxscoreGoalie {
  saves: number;
  shotsAgainst: number;
  svPctDisplay: string;
  teamAbbrev: string;
  teamLogo: string;
  evSaves: number;
  evShots: number;
  ppSaves: number;
  ppShots: number;
  shSaves: number;
  shShots: number;
}

function parseSavesShots(field: string | undefined | null): { saves: number; shots: number } {
  // NHL API uses "SV-SA" (e.g., "25-28") on modern games and "SV/SA" on some historical games.
  // Per-situation fields (even/PP/SH) can also be missing entirely on older playoff games.
  if (!field) return { saves: 0, shots: 0 };
  const parts = field.split(/[-/]/);
  if (parts.length === 2) {
    const saves = parseInt(parts[0], 10);
    const shots = parseInt(parts[1], 10);
    if (!Number.isNaN(saves) && !Number.isNaN(shots)) {
      return { saves, shots };
    }
  }
  return { saves: 0, shots: 0 };
}

function parseGoalie(goalie: BoxscoreGoalie, teamAbbrev: string, teamLogo: string): ParsedGoalie {
  const total = parseSavesShots(goalie.saveShotsAgainst);
  const ev = parseSavesShots(goalie.evenStrengthShotsAgainst);
  const pp = parseSavesShots(goalie.powerPlayShotsAgainst);
  const sh = parseSavesShots(goalie.shorthandedShotsAgainst);

  const svPct = total.shots > 0 ? (total.saves / total.shots) : 0;
  const svPctDisplay = total.shots > 0 ? svPct.toFixed(3).replace(/^0/, '') : '-';

  return {
    ...goalie,
    saves: total.saves,
    shotsAgainst: total.shots,
    svPctDisplay,
    teamAbbrev,
    teamLogo,
    evSaves: ev.saves,
    evShots: ev.shots,
    ppSaves: pp.saves,
    ppShots: pp.shots,
    shSaves: sh.saves,
    shShots: sh.shots,
  };
}

function DecisionBadge({ decision }: { decision?: string }) {
  if (!decision) return <span className="text-gray-400">-</span>;

  const colorMap: Record<string, string> = {
    W: 'bg-green-100 text-green-700',
    L: 'bg-red-100 text-red-700',
    O: 'bg-yellow-100 text-yellow-700',
  };
  const cls = colorMap[decision] ?? 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-bold ${cls}`}>
      {decision}
    </span>
  );
}

export default function GoalieStatsTable({
  homeGoalies,
  awayGoalies,
  homeAbbrev,
  awayAbbrev,
  homeLogo,
  awayLogo,
}: GoalieStatsTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const allGoalies: ParsedGoalie[] = [
    ...awayGoalies.map(g => parseGoalie(g, awayAbbrev, awayLogo)),
    ...homeGoalies.map(g => parseGoalie(g, homeAbbrev, homeLogo)),
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="font-bold text-gray-900 text-base">Goalie Stats</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] sm:min-w-[520px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="py-2 px-1.5 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-left text-gray-500">Goalie</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">Team</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">Dec</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">SA</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">SV</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">SV%</th>
              <th className="py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500">TOI</th>
              <th className="py-2 px-1 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-center text-gray-500 w-8"></th>
            </tr>
          </thead>
          <tbody>
            {allGoalies.map(goalie => (
              <React.Fragment key={goalie.playerId}>
                <tr
                  className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                >
                  <td className="py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm font-medium text-gray-900 whitespace-nowrap">
                    <span className="text-gray-400 mr-1 tabular-nums text-xs">{goalie.sweaterNumber}</span>
                    {goalie.name.default}
                  </td>
                  <td className="py-1.5 px-1 sm:px-2 text-center">
                    <Image
                      src={goalie.teamLogo}
                      alt={goalie.teamAbbrev}
                      width={20}
                      height={20}
                      className="w-5 h-5 inline-block"
                    />
                  </td>
                  <td className="py-1.5 px-1 sm:px-2 text-center">
                    <DecisionBadge decision={goalie.decision} />
                  </td>
                  <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{goalie.shotsAgainst}</td>
                  <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{goalie.saves}</td>
                  <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums font-semibold">{goalie.svPctDisplay}</td>
                  <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums text-gray-600">{goalie.toi}</td>
                  <td className="py-1.5 px-1 text-center">
                    <button
                      onClick={() => setExpandedId(expandedId === goalie.playerId ? null : goalie.playerId)}
                      className="text-gray-400 hover:text-gray-600 transition-colors p-0.5"
                      aria-label="Toggle save breakdown"
                    >
                      {expandedId === goalie.playerId
                        ? <ChevronUp className="w-4 h-4" />
                        : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
                {/* Expanded save breakdown sub-row */}
                {expandedId === goalie.playerId && (
                  <tr key={`${goalie.playerId}-detail`} className="bg-gray-50/70">
                    <td colSpan={8} className="px-4 py-2">
                      <div className="flex gap-6 text-xs text-gray-600">
                        <div>
                          <span className="font-semibold text-gray-700">EV</span>{' '}
                          <span className="tabular-nums">{goalie.evSaves}/{goalie.evShots}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">PP</span>{' '}
                          <span className="tabular-nums">{goalie.ppSaves}/{goalie.ppShots}</span>
                        </div>
                        <div>
                          <span className="font-semibold text-gray-700">SH</span>{' '}
                          <span className="tabular-nums">{goalie.shSaves}/{goalie.shShots}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
