'use client';

import type { MLBPitcherLine } from '@/lib/types/mlb';

interface Props {
  pitchers: MLBPitcherLine[];
  teamName: string;
  teamAbbrev: string;
  teamLogo: string;
}

const decisionColors: Record<string, string> = {
  W: 'text-emerald-600',
  L: 'text-red-500',
  S: 'text-blue-600',
  H: 'text-amber-600',
};

export default function MLBPitchingStats({ pitchers, teamName, teamAbbrev, teamLogo }: Props) {
  if (pitchers.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <img src={teamLogo} alt={teamAbbrev} className="w-6 h-6" />
        <h3 className="font-bold text-gray-900">{teamName} Pitching</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-3 py-2 font-semibold">Pitcher</th>
              <th className="text-center px-2 py-2 font-semibold w-12">IP</th>
              <th className="text-center px-2 py-2 font-semibold w-10">H</th>
              <th className="text-center px-2 py-2 font-semibold w-10">R</th>
              <th className="text-center px-2 py-2 font-semibold w-10">ER</th>
              <th className="text-center px-2 py-2 font-semibold w-10">BB</th>
              <th className="text-center px-2 py-2 font-semibold w-10">SO</th>
              <th className="text-center px-2 py-2 font-semibold w-12">ERA</th>
            </tr>
          </thead>
          <tbody>
            {pitchers.map((pitcher, i) => (
              <tr key={`${pitcher.name}-${i}`} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">{pitcher.name}</span>
                  {pitcher.decision && (
                    <span className={`ml-1.5 text-xs font-bold ${decisionColors[pitcher.decision] || 'text-gray-500'}`}>
                      ({pitcher.decision})
                    </span>
                  )}
                </td>
                <td className="text-center px-2 py-2 text-gray-700">{pitcher.ip}</td>
                <td className="text-center px-2 py-2 text-gray-700">{pitcher.h}</td>
                <td className="text-center px-2 py-2 text-gray-700">{pitcher.r}</td>
                <td className="text-center px-2 py-2 text-gray-700">{pitcher.er}</td>
                <td className="text-center px-2 py-2 text-gray-700">{pitcher.bb}</td>
                <td className="text-center px-2 py-2 text-gray-700 font-semibold">{pitcher.so}</td>
                <td className="text-center px-2 py-2 text-gray-500 text-xs">{pitcher.era}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
