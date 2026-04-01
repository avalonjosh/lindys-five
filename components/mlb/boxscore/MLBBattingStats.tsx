'use client';

import type { MLBBatterLine } from '@/lib/types/mlb';

interface Props {
  batters: MLBBatterLine[];
  teamName: string;
  teamAbbrev: string;
  teamLogo: string;
}

export default function MLBBattingStats({ batters, teamName, teamAbbrev, teamLogo }: Props) {
  if (batters.length === 0) return null;

  const totals = batters.reduce((acc, b) => ({
    ab: acc.ab + b.ab,
    r: acc.r + b.r,
    h: acc.h + b.h,
    rbi: acc.rbi + b.rbi,
    bb: acc.bb + b.bb,
    so: acc.so + b.so,
  }), { ab: 0, r: 0, h: 0, rbi: 0, bb: 0, so: 0 });

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 flex items-center gap-3">
        <img src={teamLogo} alt={teamAbbrev} className="w-6 h-6" />
        <h3 className="font-bold text-gray-900">{teamName} Batting</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-gray-500 text-xs uppercase">
              <th className="text-left px-3 py-2 font-semibold">Player</th>
              <th className="text-center px-2 py-2 font-semibold w-10">AB</th>
              <th className="text-center px-2 py-2 font-semibold w-10">R</th>
              <th className="text-center px-2 py-2 font-semibold w-10">H</th>
              <th className="text-center px-2 py-2 font-semibold w-10">RBI</th>
              <th className="text-center px-2 py-2 font-semibold w-10">BB</th>
              <th className="text-center px-2 py-2 font-semibold w-10">SO</th>
              <th className="text-center px-2 py-2 font-semibold w-12">AVG</th>
            </tr>
          </thead>
          <tbody>
            {batters.map((batter, i) => (
              <tr key={`${batter.name}-${i}`} className={`border-t border-gray-100 ${i % 2 === 0 ? '' : 'bg-gray-50/50'}`}>
                <td className="px-3 py-2">
                  <span className="font-medium text-gray-900">{batter.name}</span>
                  <span className="text-xs text-gray-400 ml-1.5">{batter.position}</span>
                </td>
                <td className="text-center px-2 py-2 text-gray-700">{batter.ab}</td>
                <td className="text-center px-2 py-2 text-gray-700 font-semibold">{batter.r > 0 ? batter.r : '0'}</td>
                <td className="text-center px-2 py-2 text-gray-700 font-semibold">{batter.h > 0 ? batter.h : '0'}</td>
                <td className="text-center px-2 py-2 text-gray-700">{batter.rbi > 0 ? batter.rbi : '0'}</td>
                <td className="text-center px-2 py-2 text-gray-700">{batter.bb > 0 ? batter.bb : '0'}</td>
                <td className="text-center px-2 py-2 text-gray-700">{batter.so > 0 ? batter.so : '0'}</td>
                <td className="text-center px-2 py-2 text-gray-500 text-xs">{batter.avg}</td>
              </tr>
            ))}
            {/* Totals */}
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
              <td className="px-3 py-2 text-gray-900">Totals</td>
              <td className="text-center px-2 py-2">{totals.ab}</td>
              <td className="text-center px-2 py-2">{totals.r}</td>
              <td className="text-center px-2 py-2">{totals.h}</td>
              <td className="text-center px-2 py-2">{totals.rbi}</td>
              <td className="text-center px-2 py-2">{totals.bb}</td>
              <td className="text-center px-2 py-2">{totals.so}</td>
              <td className="text-center px-2 py-2 text-gray-500 text-xs">
                {totals.ab > 0 ? (totals.h / totals.ab).toFixed(3).replace('0.', '.') : '.000'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
