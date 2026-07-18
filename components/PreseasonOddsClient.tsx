'use client';

import { useState } from 'react';
import Link from 'next/link';

// League-wide way-too-early preseason odds table. Mirrors the look of the live
// PlayoffOddsClient but with preseason semantics: there are no games yet, so the
// record shown is LAST season's and the projection is the way-too-early pace.
export interface PreseasonTeamData {
  abbrev: string;
  name: string;
  logo: string;
  slug: string;
  lastWins: number;
  lastLosses: number;
  lastOtLosses: number;
  lastPoints: number;
  projectedPoints: number; // projected over the coming season's game count
  odds: number; // way-too-early playoff probability (0-100)
  tier: string;
  divisionName: string;
  conferenceName: string;
  projectedInPlayoffs: boolean;
}

type ViewMode = 'picture' | 'division' | 'conference' | 'league';

const DIVISION_ORDER = ['Atlantic', 'Metropolitan', 'Central', 'Pacific'];
const CONFERENCE_MAP: Record<string, string> = {
  Atlantic: 'Eastern',
  Metropolitan: 'Eastern',
  Central: 'Western',
  Pacific: 'Western',
};

function oddsColor(odds: number): string {
  return odds >= 60 ? 'text-emerald-600' : odds >= 35 ? 'text-yellow-600' : 'text-red-500';
}

function TableHeader({ lastSeasonLabel }: { lastSeasonLabel: string }) {
  return (
    <thead>
      <tr className="text-gray-500 text-xs uppercase border-b border-gray-200">
        <th className="text-left py-2 px-3 w-8">#</th>
        <th className="text-left py-2 px-2">Team</th>
        <th className="text-center py-2 px-2 whitespace-nowrap">
          <span className="hidden sm:inline">{lastSeasonLabel}</span>
          <span className="sm:hidden">Last</span>
        </th>
        <th className="text-center py-2 px-2 font-bold text-gray-700">Proj</th>
        <th className="text-center py-2 px-2 font-bold text-gray-700">Odds</th>
      </tr>
    </thead>
  );
}

function TeamRow({ team, rank }: { team: PreseasonTeamData; rank: number }) {
  return (
    <tr
      className={`border-b border-gray-100 hover:bg-blue-50/50 transition-colors ${
        team.projectedInPlayoffs ? 'border-l-3 border-l-emerald-500' : 'border-l-3 border-l-transparent'
      }`}
    >
      <td className="py-2.5 px-3 text-gray-400 text-xs font-medium">{rank}</td>
      <td className="py-2.5 px-2">
        <Link href={team.slug ? `/nhl/${team.slug}` : '#'} className="flex items-center gap-2 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={team.logo} alt={team.name} className="w-6 h-6 flex-shrink-0" loading="lazy" />
          <span className="text-gray-900 font-medium group-hover:text-blue-600 transition-colors md:truncate">
            <span className="hidden md:inline">{team.name}</span>
            <span className="md:hidden whitespace-nowrap">{team.abbrev}</span>
          </span>
        </Link>
      </td>
      <td className="py-2.5 px-2 text-center text-gray-500 whitespace-nowrap">
        {team.lastWins}-{team.lastLosses}-{team.lastOtLosses}
      </td>
      <td className="py-2.5 px-2 text-center text-gray-700 font-semibold">{team.projectedPoints}</td>
      <td className={`py-2.5 px-2 text-center font-bold ${oddsColor(team.odds)}`}>{team.odds}%</td>
    </tr>
  );
}

function Section({
  title,
  subtitle,
  lastSeasonLabel,
  children,
}: {
  title: string;
  subtitle?: string;
  lastSeasonLabel: string;
  children: React.ReactNode;
}) {
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
          <TableHeader lastSeasonLabel={lastSeasonLabel} />
          <tbody>{children}</tbody>
        </table>
      </div>
      <div className="px-4 py-2 border-t border-gray-200 flex items-center gap-2 text-[10px] text-gray-500">
        <span className="inline-block w-2 h-2 rounded-sm bg-emerald-500" />
        <span>Projected playoff position</span>
      </div>
    </div>
  );
}

function PictureView({ teams, lastSeasonLabel }: { teams: PreseasonTeamData[]; lastSeasonLabel: string }) {
  const conferences = ['Eastern', 'Western'];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {conferences.map(conf => {
        const confDivisions = DIVISION_ORDER.filter(d => CONFERENCE_MAP[d] === conf);

        // Division top 3 by projected points; the remaining conference teams
        // ranked by projected points, with the top 2 as projected wild cards.
        const divSections = confDivisions.map(divName => ({
          divName,
          teams: teams
            .filter(t => t.divisionName === divName)
            .sort((a, b) => b.projectedPoints - a.projectedPoints)
            .slice(0, 3),
        }));
        const inDivisionTop3 = new Set(divSections.flatMap(s => s.teams.map(t => t.abbrev)));
        const wcTeams = teams
          .filter(t => t.conferenceName === conf && !inDivisionTop3.has(t.abbrev))
          .sort((a, b) => b.projectedPoints - a.projectedPoints);

        return (
          <div key={conf} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#003087' }}>
              <h2 className="text-xl md:text-2xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                {conf} Conference
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <TableHeader lastSeasonLabel={lastSeasonLabel} />
                <tbody>
                  {divSections.flatMap(({ divName, teams: divTeams }) => [
                    <tr key={`header-${divName}`}>
                      <td colSpan={5} className="py-1.5 px-3 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                        {divName}
                      </td>
                    </tr>,
                    ...divTeams.map((team, idx) => (
                      <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
                    )),
                  ])}

                  <tr key={`wc-header-${conf}`}>
                    <td colSpan={5} className="py-1.5 px-3 text-xs font-semibold text-gray-500 bg-gray-50 uppercase tracking-wider">
                      Wild Card
                    </td>
                  </tr>
                  {wcTeams.flatMap((team, idx) => [
                    ...(idx === 2 ? [
                      <tr key={`cutline-${conf}`}>
                        <td colSpan={5} className="px-3">
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
                Projected playoff position
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block w-6 border-t-2 border-dashed border-red-400/50" />
                Projected cut line
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DivisionView({ teams, lastSeasonLabel }: { teams: PreseasonTeamData[]; lastSeasonLabel: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {DIVISION_ORDER.map(divName => {
        const divTeams = teams
          .filter(t => t.divisionName === divName)
          .sort((a, b) => b.projectedPoints - a.projectedPoints);

        return (
          <Section key={divName} title={`${divName} Division`} subtitle={`${CONFERENCE_MAP[divName]} Conference`} lastSeasonLabel={lastSeasonLabel}>
            {divTeams.map((team, idx) => (
              <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}

function ConferenceView({ teams, lastSeasonLabel }: { teams: PreseasonTeamData[]; lastSeasonLabel: string }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {['Eastern', 'Western'].map(conf => {
        const confTeams = teams
          .filter(t => t.conferenceName === conf)
          .sort((a, b) => b.projectedPoints - a.projectedPoints);

        return (
          <Section key={conf} title={`${conf} Conference`} lastSeasonLabel={lastSeasonLabel}>
            {confTeams.map((team, idx) => (
              <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
            ))}
          </Section>
        );
      })}
    </div>
  );
}

function LeagueView({ teams, lastSeasonLabel }: { teams: PreseasonTeamData[]; lastSeasonLabel: string }) {
  const sorted = [...teams].sort((a, b) => b.projectedPoints - a.projectedPoints || b.odds - a.odds);

  return (
    <Section title="League" subtitle="Ranked by projected points" lastSeasonLabel={lastSeasonLabel}>
      {sorted.map((team, idx) => (
        <TeamRow key={team.abbrev} team={team} rank={idx + 1} />
      ))}
    </Section>
  );
}

export default function PreseasonOddsClient({
  teams,
  totalGames,
  lastSeasonLabel,
}: {
  teams: PreseasonTeamData[];
  totalGames: number;
  lastSeasonLabel: string;
}) {
  const [view, setView] = useState<ViewMode>('picture');

  const views: { key: ViewMode; label: string }[] = [
    { key: 'league', label: 'League' },
    { key: 'picture', label: 'Playoff Picture' },
    { key: 'division', label: 'Division' },
    { key: 'conference', label: 'Conference' },
  ];

  return (
    <>
      <div className="flex flex-wrap justify-center gap-1 mt-6 mb-6">
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

      {view === 'league' && <LeagueView teams={teams} lastSeasonLabel={lastSeasonLabel} />}
      {view === 'picture' && <PictureView teams={teams} lastSeasonLabel={lastSeasonLabel} />}
      {view === 'division' && <DivisionView teams={teams} lastSeasonLabel={lastSeasonLabel} />}
      {view === 'conference' && <ConferenceView teams={teams} lastSeasonLabel={lastSeasonLabel} />}

      <div className="mt-8 bg-white rounded-xl border border-gray-200 px-5 py-4 text-sm text-gray-500 flex flex-wrap gap-x-6 gap-y-2 shadow-sm">
        <span><strong className="text-gray-700">{lastSeasonLabel}</strong> = last season&apos;s record (W-L-OTL)</span>
        <span><strong className="text-gray-700">Proj</strong> = projected {totalGames}-game point total</span>
        <span><strong className="text-gray-700">Odds</strong> = way-too-early playoff probability</span>
      </div>

      <p className="mt-4 text-center text-xs text-gray-400 max-w-2xl mx-auto">
        Way-too-early projection off last season&apos;s pace regressed toward the league average. It ignores roster moves, injuries, and schedule; live odds take over once the season begins.
      </p>
    </>
  );
}
