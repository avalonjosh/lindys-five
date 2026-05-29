'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import type { MLBStandingsTeam } from '@/lib/types/mlb';

export interface MLBTeamRow {
  team: MLBStandingsTeam;
  slug: string;
  probability: number;
  projectedWins: number;
  inPlayoffs: boolean;
}

type ViewMode = 'wildcard' | 'division' | 'leagues' | 'all';

const DIVISION_ORDER = [
  'American League East',
  'American League Central',
  'American League West',
  'National League East',
  'National League Central',
  'National League West',
];

function shortDivisionLabel(division: string): string {
  return division.replace('American League ', 'AL ').replace('National League ', 'NL ');
}

function formatGB(gb: number): string {
  if (gb === 0) return '—';
  if (Number.isInteger(gb)) return String(gb);
  return gb.toFixed(1);
}

function probabilityColor(prob: number, inPlayoffs: boolean): string {
  if (prob >= 95) return 'bg-emerald-100 text-emerald-900 border-emerald-300';
  if (prob >= 70) return inPlayoffs
    ? 'bg-green-100 text-green-900 border-green-300'
    : 'bg-lime-100 text-lime-900 border-lime-300';
  if (prob >= 40) return 'bg-amber-100 text-amber-900 border-amber-300';
  if (prob >= 15) return 'bg-orange-100 text-orange-900 border-orange-300';
  return 'bg-red-100 text-red-900 border-red-300';
}

function TeamCell({ team, slug, suffix }: { team: MLBStandingsTeam; slug: string; suffix?: React.ReactNode }) {
  const inner = (
    <>
      <Image
        src={team.teamLogo}
        alt={`${team.teamName} logo`}
        width={24}
        height={24}
        className="w-6 h-6 object-contain"
      />
      <span className="font-semibold text-gray-900">{team.teamName}</span>
      {suffix}
    </>
  );
  if (slug) {
    return (
      <Link href={`/mlb/${slug}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center gap-2">{inner}</div>;
}

function DivisionTable({ league, division, rows }: { league: 'AL' | 'NL'; division: string; rows: MLBTeamRow[] }) {
  const headerBg = league === 'AL' ? '#0C2340' : '#A6192E';

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-3 border-b-2" style={{ background: headerBg, borderBottomColor: '#000' }}>
        <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {shortDivisionLabel(division)}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-right px-2 py-2">W</th>
              <th className="text-right px-2 py-2">L</th>
              <th className="text-right px-2 py-2">PCT</th>
              <th className="text-right px-2 py-2 hidden sm:table-cell">GB</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">Pace</th>
              <th className="text-right px-3 py-2">Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, slug, probability, projectedWins, inPlayoffs }, idx) => {
              const isDivWinner = idx === 0;
              return (
                <tr key={team.teamAbbrev} className={`border-t border-gray-100 ${isDivWinner ? 'bg-blue-50/40' : ''}`}>
                  <td className="px-3 py-2">
                    <TeamCell
                      team={team}
                      slug={slug}
                      suffix={inPlayoffs ? <span className="text-xs text-emerald-600 font-bold">✓</span> : undefined}
                    />
                  </td>
                  <td className="text-right px-2 py-2 font-semibold text-gray-900">{team.wins}</td>
                  <td className="text-right px-2 py-2 text-gray-700">{team.losses}</td>
                  <td className="text-right px-2 py-2 text-gray-700 tabular-nums">.{(team.winPct * 1000).toFixed(0).padStart(3, '0')}</td>
                  <td className="text-right px-2 py-2 text-gray-600 hidden sm:table-cell tabular-nums">{formatGB(team.gamesBack)}</td>
                  <td className="text-right px-2 py-2 text-gray-600 hidden md:table-cell tabular-nums">{projectedWins}</td>
                  <td className="text-right px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${probabilityColor(probability, inPlayoffs)}`}>
                      {probability}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WildCardSection({ league, rows }: { league: 'American League' | 'National League'; rows: MLBTeamRow[] }) {
  const divisionsInLeague = Array.from(new Set(rows.map(r => r.team.division)));
  const winners = new Set<string>();
  for (const div of divisionsInLeague) {
    const top = rows.filter(r => r.team.division === div).sort((a, b) => b.team.wins - a.team.wins)[0];
    if (top) winners.add(top.team.teamAbbrev);
  }
  const contenders = rows
    .filter(r => !winners.has(r.team.teamAbbrev))
    .sort((a, b) => b.team.wins - a.team.wins);

  const shortLeague = league === 'American League' ? 'AL' : 'NL';
  const headerBg = league === 'American League' ? '#0C2340' : '#A6192E';

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-3 border-b-2" style={{ background: headerBg, borderBottomColor: '#000' }}>
        <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {shortLeague} Wild Card
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-right px-2 py-2">W</th>
              <th className="text-right px-2 py-2">L</th>
              <th className="text-right px-2 py-2 hidden sm:table-cell">WCGB</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">Pace</th>
              <th className="text-right px-3 py-2">Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {contenders.map(({ team, slug, probability, projectedWins }, idx) => {
              const isAboveCut = idx < 3;
              const isCutLine = idx === 2;
              return (
                <tr key={team.teamAbbrev} className={`border-t border-gray-100 ${isAboveCut ? 'bg-emerald-50/30' : ''} ${isCutLine ? 'border-b-2 border-b-emerald-400' : ''}`}>
                  <td className="px-3 py-2">
                    <TeamCell
                      team={team}
                      slug={slug}
                      suffix={isAboveCut ? <span className="text-xs text-emerald-600 font-bold">WC{idx + 1}</span> : undefined}
                    />
                  </td>
                  <td className="text-right px-2 py-2 font-semibold text-gray-900">{team.wins}</td>
                  <td className="text-right px-2 py-2 text-gray-700">{team.losses}</td>
                  <td className="text-right px-2 py-2 text-gray-600 hidden sm:table-cell tabular-nums">{formatGB(team.wildCardGamesBack)}</td>
                  <td className="text-right px-2 py-2 text-gray-600 hidden md:table-cell tabular-nums">{projectedWins}</td>
                  <td className="text-right px-3 py-2">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${probabilityColor(probability, isAboveCut)}`}>
                      {probability}%
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="px-3 py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-100">
          Top 3 wild card teams qualify. Cut line shown below WC3.
        </div>
      </div>
    </div>
  );
}

function LeagueTable({ league, rows }: { league: 'American League' | 'National League'; rows: MLBTeamRow[] }) {
  const sorted = [...rows].sort((a, b) => b.team.wins - a.team.wins || a.team.losses - b.team.losses);
  const headerBg = league === 'American League' ? '#0C2340' : '#A6192E';
  const shortLeague = league === 'American League' ? 'AL' : 'NL';

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden mb-6">
      <div className="px-4 py-3 border-b-2" style={{ background: headerBg, borderBottomColor: '#000' }}>
        <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {shortLeague} Standings
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-right px-2 py-2">W</th>
              <th className="text-right px-2 py-2">L</th>
              <th className="text-right px-2 py-2">PCT</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">Pace</th>
              <th className="text-right px-3 py-2">Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ team, slug, probability, projectedWins, inPlayoffs }, idx) => (
              <tr key={team.teamAbbrev} className="border-t border-gray-100">
                <td className="px-2 py-2 text-gray-400 text-xs font-medium">{idx + 1}</td>
                <td className="px-3 py-2">
                  <TeamCell
                    team={team}
                    slug={slug}
                    suffix={inPlayoffs ? <span className="text-xs text-emerald-600 font-bold">✓</span> : undefined}
                  />
                </td>
                <td className="text-right px-2 py-2 font-semibold text-gray-900">{team.wins}</td>
                <td className="text-right px-2 py-2 text-gray-700">{team.losses}</td>
                <td className="text-right px-2 py-2 text-gray-700 tabular-nums">.{(team.winPct * 1000).toFixed(0).padStart(3, '0')}</td>
                <td className="text-right px-2 py-2 text-gray-600 hidden md:table-cell tabular-nums">{projectedWins}</td>
                <td className="text-right px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${probabilityColor(probability, inPlayoffs)}`}>
                    {probability}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AllTeamsTable({ rows }: { rows: MLBTeamRow[] }) {
  const sorted = [...rows].sort((a, b) => b.team.wins - a.team.wins || a.team.losses - b.team.losses);

  return (
    <div className="bg-white rounded-2xl shadow-md border-2 border-gray-200 overflow-hidden">
      <div className="px-4 py-3 border-b-2" style={{ background: '#002D72', borderBottomColor: '#000' }}>
        <h3 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          MLB Standings
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-2 py-2 w-8">#</th>
              <th className="text-left px-3 py-2">Team</th>
              <th className="text-left px-2 py-2 hidden sm:table-cell">League</th>
              <th className="text-right px-2 py-2">W</th>
              <th className="text-right px-2 py-2">L</th>
              <th className="text-right px-2 py-2">PCT</th>
              <th className="text-right px-2 py-2 hidden md:table-cell">Pace</th>
              <th className="text-right px-3 py-2">Playoff %</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(({ team, slug, probability, projectedWins, inPlayoffs }, idx) => (
              <tr key={team.teamAbbrev} className="border-t border-gray-100">
                <td className="px-2 py-2 text-gray-400 text-xs font-medium">{idx + 1}</td>
                <td className="px-3 py-2">
                  <TeamCell
                    team={team}
                    slug={slug}
                    suffix={inPlayoffs ? <span className="text-xs text-emerald-600 font-bold">✓</span> : undefined}
                  />
                </td>
                <td className="px-2 py-2 text-xs text-gray-500 hidden sm:table-cell">
                  {team.league === 'American League' ? 'AL' : 'NL'}
                </td>
                <td className="text-right px-2 py-2 font-semibold text-gray-900">{team.wins}</td>
                <td className="text-right px-2 py-2 text-gray-700">{team.losses}</td>
                <td className="text-right px-2 py-2 text-gray-700 tabular-nums">.{(team.winPct * 1000).toFixed(0).padStart(3, '0')}</td>
                <td className="text-right px-2 py-2 text-gray-600 hidden md:table-cell tabular-nums">{projectedWins}</td>
                <td className="text-right px-3 py-2">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border tabular-nums ${probabilityColor(probability, inPlayoffs)}`}>
                    {probability}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function WildCardView({ alRows, nlRows }: { alRows: MLBTeamRow[]; nlRows: MLBTeamRow[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <WildCardSection league="American League" rows={alRows} />
      <WildCardSection league="National League" rows={nlRows} />
    </div>
  );
}

function DivisionView({ rowsByDivision }: { rowsByDivision: Map<string, MLBTeamRow[]> }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {DIVISION_ORDER.map(div => {
        const league = div.startsWith('American') ? 'AL' : 'NL';
        return (
          <DivisionTable
            key={div}
            league={league}
            division={div}
            rows={rowsByDivision.get(div) || []}
          />
        );
      })}
    </div>
  );
}

function LeagueSplitView({ alRows, nlRows }: { alRows: MLBTeamRow[]; nlRows: MLBTeamRow[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <LeagueTable league="American League" rows={alRows} />
      <LeagueTable league="National League" rows={nlRows} />
    </div>
  );
}

export default function MLBPlayoffOddsClient({ rows }: { rows: MLBTeamRow[] }) {
  const [view, setView] = useState<ViewMode>('wildcard');

  const rowsByDivision = new Map<string, MLBTeamRow[]>();
  for (const div of DIVISION_ORDER) {
    rowsByDivision.set(
      div,
      rows.filter(r => r.team.division === div).sort((a, b) => b.team.wins - a.team.wins),
    );
  }
  const alRows = rows.filter(r => r.team.league === 'American League');
  const nlRows = rows.filter(r => r.team.league === 'National League');

  const views: { key: ViewMode; label: string }[] = [
    { key: 'wildcard', label: 'Wild Card' },
    { key: 'division', label: 'Division' },
    { key: 'leagues', label: 'AL/NL' },
    { key: 'all', label: 'League' },
  ];

  return (
    <>
      <div className="flex justify-center flex-wrap gap-1 mt-2 mb-6">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              view === v.key ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
            }`}
            style={view === v.key ? { background: '#002D72' } : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'wildcard' && <WildCardView alRows={alRows} nlRows={nlRows} />}
      {view === 'division' && <DivisionView rowsByDivision={rowsByDivision} />}
      {view === 'leagues' && <LeagueSplitView alRows={alRows} nlRows={nlRows} />}
      {view === 'all' && <AllTeamsTable rows={rows} />}
    </>
  );
}
