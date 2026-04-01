'use client';

import Link from 'next/link';
import type { MLBBoxScoreData } from '@/lib/types/mlb';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';

export default function MLBGameHeader({ data }: { data: MLBBoxScoreData }) {
  const isLive = data.status === 'In Progress';
  const isComplete = data.status === 'Final' || data.status === 'Completed Early';
  const awayWon = isComplete && data.linescore.away.runs > data.linescore.home.runs;
  const homeWon = isComplete && data.linescore.home.runs > data.linescore.away.runs;
  const awaySlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === data.awayTeam.abbreviation)?.id;
  const homeSlug = Object.values(MLB_TEAMS).find(t => t.abbreviation === data.homeTeam.abbreviation)?.id;

  const gameDate = data.dateTime ? new Date(data.dateTime) : null;
  const dateStr = gameDate?.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const timeStr = gameDate?.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' });

  return (
    <div className="bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Status bar */}
      <div className={`text-center py-2 text-sm font-bold text-white ${
        isLive ? 'bg-green-600' : isComplete ? 'bg-gray-700' : 'bg-blue-600'
      }`}>
        {isLive && (
          <span className="inline-flex items-center gap-2">
            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            {data.inningHalf === 'top' ? 'Top' : data.inningHalf === 'bottom' ? 'Bottom' : ''} {data.currentInning ? ordinal(data.currentInning) : 'Live'}
          </span>
        )}
        {isComplete && 'Final'}
        {!isLive && !isComplete && (timeStr ? `${timeStr} ET` : 'Scheduled')}
      </div>

      {/* Teams + Score */}
      <div className="px-4 md:px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          {/* Away */}
          <div className={`flex items-center gap-3 flex-1 ${isComplete && !awayWon ? 'opacity-50' : ''}`}>
            {awaySlug ? (
              <Link href={`/mlb/${awaySlug}`} className="hover:scale-110 transition-transform">
                <img src={data.awayTeam.logo} alt={data.awayTeam.abbreviation} className="w-12 h-12 md:w-16 md:h-16" />
              </Link>
            ) : (
              <img src={data.awayTeam.logo} alt={data.awayTeam.abbreviation} className="w-12 h-12 md:w-16 md:h-16" />
            )}
            <div>
              <div className="text-lg md:text-xl font-bold text-gray-900">{data.awayTeam.teamName}</div>
              <div className="text-xs text-gray-500">{data.awayTeam.abbreviation}</div>
            </div>
          </div>

          {/* Score */}
          <div className="flex items-center gap-3 md:gap-6">
            <span className={`text-4xl md:text-5xl font-bold ${isComplete && !awayWon ? 'text-gray-400' : 'text-gray-900'}`}>
              {isComplete || isLive ? data.linescore.away.runs : ''}
            </span>
            <span className="text-xl text-gray-300">-</span>
            <span className={`text-4xl md:text-5xl font-bold ${isComplete && !homeWon ? 'text-gray-400' : 'text-gray-900'}`}>
              {isComplete || isLive ? data.linescore.home.runs : ''}
            </span>
          </div>

          {/* Home */}
          <div className={`flex items-center gap-3 flex-1 justify-end ${isComplete && !homeWon ? 'opacity-50' : ''}`}>
            <div className="text-right">
              <div className="text-lg md:text-xl font-bold text-gray-900">{data.homeTeam.teamName}</div>
              <div className="text-xs text-gray-500">{data.homeTeam.abbreviation}</div>
            </div>
            {homeSlug ? (
              <Link href={`/mlb/${homeSlug}`} className="hover:scale-110 transition-transform">
                <img src={data.homeTeam.logo} alt={data.homeTeam.abbreviation} className="w-12 h-12 md:w-16 md:h-16" />
              </Link>
            ) : (
              <img src={data.homeTeam.logo} alt={data.homeTeam.abbreviation} className="w-12 h-12 md:w-16 md:h-16" />
            )}
          </div>
        </div>
      </div>

      {/* Linescore */}
      {data.linescore.innings.length > 0 && (
        <div className="border-t border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-500 w-16">Team</th>
                {data.linescore.innings.map(inn => (
                  <th key={inn.num} className="text-center px-1.5 py-2 font-semibold text-gray-500 w-8">{inn.num}</th>
                ))}
                <th className="text-center px-2 py-2 font-bold text-gray-700 w-10 border-l border-gray-200">R</th>
                <th className="text-center px-2 py-2 font-bold text-gray-700 w-10">H</th>
                <th className="text-center px-2 py-2 font-bold text-gray-700 w-10">E</th>
              </tr>
            </thead>
            <tbody>
              {/* Away */}
              <tr className={isComplete && !awayWon ? 'text-gray-400' : ''}>
                <td className="px-3 py-2 font-bold">{data.awayTeam.abbreviation}</td>
                {data.linescore.innings.map(inn => (
                  <td key={inn.num} className="text-center px-1.5 py-2">{inn.away.runs}</td>
                ))}
                <td className="text-center px-2 py-2 font-bold border-l border-gray-200">{data.linescore.away.runs}</td>
                <td className="text-center px-2 py-2">{data.linescore.away.hits}</td>
                <td className="text-center px-2 py-2">{data.linescore.away.errors}</td>
              </tr>
              {/* Home */}
              <tr className={`border-t border-gray-100 ${isComplete && !homeWon ? 'text-gray-400' : ''}`}>
                <td className="px-3 py-2 font-bold">{data.homeTeam.abbreviation}</td>
                {data.linescore.innings.map(inn => (
                  <td key={inn.num} className="text-center px-1.5 py-2">{inn.home.runs}</td>
                ))}
                <td className="text-center px-2 py-2 font-bold border-l border-gray-200">{data.linescore.home.runs}</td>
                <td className="text-center px-2 py-2">{data.linescore.home.hits}</td>
                <td className="text-center px-2 py-2">{data.linescore.home.errors}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Venue + Date */}
      <div className="border-t border-gray-200 px-4 py-2 text-center text-xs text-gray-500">
        {data.venue} &bull; {dateStr}
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
