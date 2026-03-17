'use client';

import { useState } from 'react';
import Link from 'next/link';

export interface TeamData {
  abbrev: string;
  name: string;
  logo: string;
  slug: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  otLosses: number;
  points: number;
  pointPctg: number;
  pace: number;
  odds: number;
  streakCode: string;
  streakCount: number;
  divisionName: string;
  conferenceName: string;
  divisionSequence: number;
  conferenceSequence: number;
  isInPlayoffs: boolean;
}

type ViewMode = 'wildcard' | 'division' | 'conference' | 'league';

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];
const CONFERENCE_MAP: Record<string, string> = {
  Atlantic: 'Eastern',
  Metropolitan: 'Eastern',
  Central: 'Western',
  Pacific: 'Western',
};

function TableHeader() {
  return (
    <thead>
      <tr className="text-gray-500 text-xs uppercase border-b border-gray-200">
        <th className="text-left py-2 px-3 w-8">#</th>
        <th className="text-left py-2 px-2">Team</th>
        <th className="text-center py-2 px-2">GP</th>
        <th className="text-center py-2 px-2">
          <span className="hidden sm:inline">Record</span>
          <span className="sm:hidden">W-L</span>
        </th>
        <th className="text-center py-2 px-2 font-bold text-gray-700">PTS</th>
        <th className="text-center py-2 px-2 hidden xl:table-cell">PTS%</th>
        <th className="text-center py-2 px-2">Pace</th>
        <th className="text-center py-2 px-2 font-bold text-gray-700">Odds</th>
        <th className="text-center py-2 px-2 hidden 2xl:table-cell">Strk</th>
      </tr>
    </thead>
  );
}

function TeamRow({ team, rank }: { team: TeamData; rank: number }) {
  return (
    <tr
      className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${
        team.isInPlayoffs ? 'border-l-3 border-l-emerald-500' : 'border-l-3 border-l-transparent'
      }`}
    >
      <td className="py-2.5 px-3 text-gray-400 text-xs font-medium">{rank}</td>
      <td className="py-2.5 px-2">
        <Link href={team.slug ? `/${team.slug}` : '#'} className="flex items-center gap-2 group">
          <img src={team.logo} alt={team.name} className="w-6 h-6 flex-shrink-0" loading="lazy" />
          <span className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors md:truncate">
            <span className="hidden md:inline">{team.name}</span>
            <span className="md:hidden whitespace-nowrap">{team.abbrev}</span>
          </span>
        </Link>
      </td>
      <td className="py-2.5 px-2 text-center text-gray-500">{team.gamesPlayed}</td>
      <td className="py-2.5 px-2 text-center text-gray-700 whitespace-nowrap">
        {team.wins}-{team.losses}-{team.otLosses}
      </td>
      <td className="py-2.5 px-2 text-center text-gray-900 font-bold">{team.points}</td>
      <td className="py-2.5 px-2 text-center text-gray-500 hidden xl:table-cell">
        {(team.pointPctg * 100).toFixed(1)}
      </td>
      <td className={`py-2.5 px-2 text-center font-semibold ${
        team.pace >= 100 ? 'text-emerald-600' : team.pace >= 90 ? 'text-yellow-600' : 'text-red-500'
      }`}>
        {team.pace}
      </td>
      <td className={`py-2.5 px-2 text-center font-bold ${
        team.odds >= 75 ? 'text-emerald-600' : team.odds >= 40 ? 'text-yellow-600' : 'text-red-500'
      }`}>
        {team.odds}%
      </td>
      <td className="py-2.5 px-2 text-center text-gray-500 hidden 2xl:table-cell whitespace-nowrap">
        {team.streakCode}{team.streakCount}
      </td>
    </tr>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#003087' }}>
        <h2 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          {title}
        </h2>
        {subtitle && <p className="text-xs text-white/70 uppercase tracking-wider">{subtitle}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-0">
          <TableHeader />
          <tbody>{children}</tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2 text-[10px] text-gray-500">
        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
        <span>Playoff position</span>
      </div>
    </div>
  );
}

function WildcardView({ teams }: { teams: TeamData[] }) {
  const conferences = ['Eastern', 'Western'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {conferences.map(conf => {
        const confDivisions = DIVISION_ORDER.filter(d => CONFERENCE_MAP[d] === conf);

        const divSections = confDivisions.map(divName => ({
          divName,
          teams: teams
            .filter(t => t.divisionName === divName)
            .sort((a, b) => a.divisionSequence - b.divisionSequence)
            .slice(0, 3),
        }));

        const wcTeams = teams
          .filter(t => t.conferenceName === conf && t.divisionSequence > 3)
          .sort((a, b) => b.points - a.points);

        return (
          <div key={conf} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#003087' }}>
              <h2 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {conf} Conference
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <TableHeader />
                <tbody>
                  {divSections.flatMap(({ divName, teams: divTeams }) => [
                    <tr key={`header-${divName}`}>
                      <td colSpan={9} className="py-1.5 px-3 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                        {divName}
                      </td>
                    </tr>,
                    ...divTeams.map((team, idx) => (
                      <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
                    )),
                  ])}

                  <tr key={`wc-header-${conf}`}>
                    <td colSpan={9} className="py-1.5 px-3 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                      Wild Card
                    </td>
                  </tr>
                  {wcTeams.flatMap((team, idx) => [
                    ...(idx === 2 ? [
                      <tr key={`cutline-${conf}`}>
                        <td colSpan={9} className="px-3">
                          <div className="border-t-2 border-dashed border-red-400/50 my-0.5" />
                        </td>
                      </tr>,
                    ] : []),
                    <TeamRow key={team.abbrev} team={team} rank={idx + 1} />,
                  ])}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-4 text-[10px] text-gray-500">
              <span className="flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
                Playoff position
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-dashed border-red-400/50" />
                Playoff cut line
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DivisionView({ teams }: { teams: TeamData[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {DIVISION_ORDER.map(divName => {
        const divTeams = teams
          .filter(t => t.divisionName === divName)
          .sort((a, b) => a.divisionSequence - b.divisionSequence);

        return (
          <Section key={divName} title={`${divName} Division`} subtitle={`${CONFERENCE_MAP[divName]} Conference`}>
            {divTeams.map((team, idx) => (
              <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}

function ConferenceView({ teams }: { teams: TeamData[] }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {['Eastern', 'Western'].map(conf => {
        const confTeams = teams
          .filter(t => t.conferenceName === conf)
          .sort((a, b) => a.conferenceSequence - b.conferenceSequence);

        return (
          <Section key={conf} title={`${conf} Conference`}>
            {confTeams.map((team, idx) => (
              <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}

function LeagueView({ teams }: { teams: TeamData[] }) {
  const sorted = [...teams].sort((a, b) => b.points - a.points || a.gamesPlayed - b.gamesPlayed);

  return (
    <Section title="League Standings">
      {sorted.map((team, idx) => (
        <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
      ))}
    </Section>
  );
}

export default function PlayoffOddsClient({ teams }: { teams: TeamData[] }) {
  const [view, setView] = useState<ViewMode>('wildcard');

  const views: { key: ViewMode; label: string }[] = [
    { key: 'wildcard', label: 'Wild Card' },
    { key: 'division', label: 'Division' },
    { key: 'conference', label: 'Conference' },
    { key: 'league', label: 'League' },
  ];

  return (
    <>
      <div className="flex justify-center gap-1 mt-6 mb-6">
        {views.map(v => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              view === v.key
                ? 'text-white'
                : 'bg-gray-200 text-gray-600 hover:bg-gray-300 hover:text-gray-800'
            }`}
            style={view === v.key ? { background: '#003087' } : undefined}
          >
            {v.label}
          </button>
        ))}
      </div>

      {view === 'wildcard' && <WildcardView teams={teams} />}
      {view === 'division' && <DivisionView teams={teams} />}
      {view === 'conference' && <ConferenceView teams={teams} />}
      {view === 'league' && <LeagueView teams={teams} />}

      <div className="mt-8 bg-white rounded-xl border border-gray-200 px-5 py-4 text-sm text-gray-500 flex flex-wrap gap-x-6 gap-y-2 shadow-sm">
        <span><strong className="text-gray-700">Pace</strong> = projected 82-game point total</span>
        <span><strong className="text-gray-700">Odds</strong> = playoff probability</span>
        <span><strong className="text-gray-700">PTS%</strong> = points percentage</span>
        <span><strong className="text-gray-700">WC</strong> = wildcard spot</span>
      </div>
    </>
  );
}
