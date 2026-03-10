'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { BoxscorePlayer } from '@/lib/types/boxscore';
import { TEAMS } from '@/lib/teamConfig';

interface PlayerStatsTableProps {
  forwards: BoxscorePlayer[];
  defense: BoxscorePlayer[];
  teamAbbrev: string;
  teamName: string;
  teamLogo: string;
}

type SortColumn = 'name' | 'g' | 'a' | 'pts' | 'pm' | 'pim' | 'sog' | 'hits' | 'blk' | 'toi';
type SortDirection = 'asc' | 'desc';

const columns: { key: SortColumn; label: string; abbr: string }[] = [
  { key: 'name', label: 'Player', abbr: 'Player' },
  { key: 'g', label: 'G', abbr: 'G' },
  { key: 'a', label: 'A', abbr: 'A' },
  { key: 'pts', label: 'PTS', abbr: 'PTS' },
  { key: 'pm', label: '+/-', abbr: '+/-' },
  { key: 'pim', label: 'PIM', abbr: 'PIM' },
  { key: 'sog', label: 'SOG', abbr: 'SOG' },
  { key: 'hits', label: 'Hits', abbr: 'Hits' },
  { key: 'blk', label: 'BLK', abbr: 'BLK' },
  { key: 'toi', label: 'TOI', abbr: 'TOI' },
];

function toiToSeconds(toi: string): number {
  const parts = toi.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

function getSortValue(player: BoxscorePlayer, col: SortColumn): string | number {
  switch (col) {
    case 'name': return player.name.default;
    case 'g': return player.goals;
    case 'a': return player.assists;
    case 'pts': return player.points;
    case 'pm': return player.plusMinus;
    case 'pim': return player.pim;
    case 'sog': return player.sog;
    case 'hits': return player.hits;
    case 'blk': return player.blockedShots;
    case 'toi': return toiToSeconds(player.toi);
  }
}

function sortPlayers(players: BoxscorePlayer[], col: SortColumn, dir: SortDirection): BoxscorePlayer[] {
  return [...players].sort((a, b) => {
    const aVal = getSortValue(a, col);
    const bVal = getSortValue(b, col);
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return dir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return dir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });
}

function SortIndicator({ column, sortColumn, sortDirection }: { column: SortColumn; sortColumn: SortColumn; sortDirection: SortDirection }) {
  if (column !== sortColumn) return null;
  return sortDirection === 'asc'
    ? <ChevronUp className="inline-block w-3 h-3 ml-0.5" />
    : <ChevronDown className="inline-block w-3 h-3 ml-0.5" />;
}

function PlayerRow({ player }: { player: BoxscorePlayer }) {
  return (
    <tr className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors">
      <td className="sticky left-0 bg-white z-10 py-1.5 px-1.5 sm:px-2 text-xs sm:text-sm whitespace-nowrap font-medium text-gray-900">
        <span className="text-gray-400 mr-1 tabular-nums text-xs">{player.sweaterNumber}</span>
        {player.name.default}
      </td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.goals}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.assists}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums font-semibold">{player.points}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">
        {player.plusMinus > 0 ? `+${player.plusMinus}` : player.plusMinus}
      </td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.pim}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.sog}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.hits}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums">{player.blockedShots}</td>
      <td className="py-1.5 px-1 sm:px-2 text-xs sm:text-sm text-center tabular-nums text-gray-600">{player.toi}</td>
    </tr>
  );
}

export default function PlayerStatsTable({ forwards, defense, teamAbbrev, teamName, teamLogo }: PlayerStatsTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('pts');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const teamConfig = useMemo(
    () => Object.values(TEAMS).find(t => t.abbreviation === teamAbbrev),
    [teamAbbrev]
  );
  const primaryColor = teamConfig?.colors.primary ?? '#111111';

  const sortedForwards = useMemo(() => sortPlayers(forwards, sortColumn, sortDirection), [forwards, sortColumn, sortDirection]);
  const sortedDefense = useMemo(() => sortPlayers(defense, sortColumn, sortDirection), [defense, sortColumn, sortDirection]);

  const handleSort = (col: SortColumn) => {
    if (sortColumn === col) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(col);
      setSortDirection(col === 'name' ? 'asc' : 'desc');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      {/* Team header with color accent */}
      <div
        className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: `3px solid ${primaryColor}` }}
      >
        <Image src={teamLogo} alt={teamName} width={32} height={32} className="w-8 h-8" />
        <h3 className="font-bold text-gray-900 text-base">{teamName}</h3>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[500px] sm:min-w-[600px]">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`py-2 px-1 sm:px-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide cursor-pointer select-none transition-colors hover:bg-gray-100 ${
                    col.key === 'name'
                      ? 'sticky left-0 bg-gray-50 z-10 text-left'
                      : 'text-center'
                  } ${sortColumn === col.key ? 'text-gray-900' : 'text-gray-500'}`}
                >
                  {col.abbr}
                  <SortIndicator column={col.key} sortColumn={sortColumn} sortDirection={sortDirection} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Forwards sub-header */}
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50/60"
              >
                Forwards
              </td>
            </tr>
            {sortedForwards.map(player => (
              <PlayerRow key={player.playerId} player={player} />
            ))}

            {/* Defense sub-header */}
            <tr>
              <td
                colSpan={columns.length}
                className="px-2 py-1.5 text-xs font-bold uppercase tracking-wider text-gray-400 bg-gray-50/60"
              >
                Defense
              </td>
            </tr>
            {sortedDefense.map(player => (
              <PlayerRow key={player.playerId} player={player} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
