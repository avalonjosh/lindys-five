'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import { ClipboardList, Users, CalendarCheck, Shield, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import {
  Card,
  PageHeader,
  SectionHeading,
  Button,
  Select,
  Badge,
  Spinner,
  StatCard,
  Segmented,
  Table,
  Th,
  Td,
  EmptyState,
  ErrorBanner,
} from './ui';
import { NHL_TEAMS, MLB_TEAMS, NFL_TEAMS } from '@/lib/teamConfig';
import type { AdminWhatIfRow } from '@/app/api/admin/whatif/route';

type Sport = 'nhl' | 'mlb' | 'nfl';

interface WhatIfStats {
  totalSaves: number;
  uniqueUsers: number;
  savesToday: number;
  teamCounts: Record<string, number>; // key = `${sport}:${teamId}`
}

const SPORT_TEAMS: Record<Sport, Record<string, { city: string; name: string; id: string }>> = {
  nhl: NHL_TEAMS,
  mlb: MLB_TEAMS,
  nfl: NFL_TEAMS,
};

const OUTCOME_BADGE: Record<string, 'success' | 'warning' | 'error'> = {
  W: 'success',
  OTL: 'warning',
  L: 'error',
};

function teamLabel(sport: Sport, teamId: string): string {
  const team = SPORT_TEAMS[sport]?.[teamId];
  return team ? `${team.city} ${team.name}` : teamId;
}

function formatSavedAt(savedAt: number, savedDate: string): string {
  if (!savedAt) return savedDate;
  return new Date(savedAt).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatSeason(season: string): string {
  return season.length === 8 ? `${season.slice(0, 4)}-${season.slice(6)}` : season;
}

export default function WhatIfDashboard() {
  const [sport, setSport] = useState<Sport>('nhl');
  const [team, setTeam] = useState('');
  const [stats, setStats] = useState<WhatIfStats | null>(null);
  const [saves, setSaves] = useState<AdminWhatIfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillMessage, setBackfillMessage] = useState('');

  const loadData = useCallback(async (s: Sport, t: string) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sport: s, limit: '100' });
      if (t) params.set('team', t);
      const res = await fetch(`/api/admin/whatif?${params}`, { credentials: 'include' });
      if (!res.ok) {
        setError(res.status === 401 ? 'Session expired — please log in again' : `Failed to load data (${res.status})`);
        setLoading(false);
        return;
      }
      const data = await res.json();
      setStats(data.stats || null);
      setSaves(data.saves || []);
    } catch (err) {
      console.error('Failed to load What-If data:', err);
      setError('Failed to load What-If data');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData(sport, team);
  }, [sport, team, loadData]);

  async function runBackfill() {
    setBackfilling(true);
    setBackfillMessage('');
    try {
      const res = await fetch('/api/admin/whatif', { method: 'POST', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) {
        setBackfillMessage(data.error || 'Backfill failed');
      } else {
        setBackfillMessage(`Indexed ${data.indexed} of ${data.scanned} saves`);
        loadData(sport, team);
      }
    } catch {
      setBackfillMessage('Backfill failed');
    }
    setBackfilling(false);
  }

  const teamOptions = Object.values(SPORT_TEAMS[sport]).sort((a, b) =>
    `${a.city} ${a.name}`.localeCompare(`${b.city} ${b.name}`)
  );

  // Per-team save counts for the current sport, busiest first.
  const sportTeamCounts = Object.entries(stats?.teamCounts || {})
    .filter(([key]) => key.startsWith(`${sport}:`))
    .map(([key, count]) => ({ teamId: key.split(':')[1], count }))
    .sort((a, b) => b.count - a.count);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="What-If Picks"
        description="Saved pick activity across every account"
        actions={
          <Button onClick={runBackfill} disabled={backfilling} size="sm">
            <RefreshCw className={`h-3.5 w-3.5 ${backfilling ? 'animate-spin' : ''}`} />
            Backfill Index
          </Button>
        }
      />
      {backfillMessage && <p className="-mt-4 text-xs text-gray-500">{backfillMessage}</p>}
      {error && <ErrorBanner>{error}</ErrorBanner>}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Total Saves" value={stats?.totalSaves ?? 0} icon={<ClipboardList className="h-6 w-6" />} />
        <StatCard label="Unique Users" value={stats?.uniqueUsers ?? 0} icon={<Users className="h-6 w-6" />} />
        <StatCard label="Saves Today" value={stats?.savesToday ?? 0} icon={<CalendarCheck className="h-6 w-6" />} />
        <StatCard
          label="Teams With Saves"
          value={sportTeamCounts.length}
          sub={sport.toUpperCase()}
          icon={<Shield className="h-6 w-6" />}
        />
      </div>

      {/* Saves by team */}
      {sportTeamCounts.length > 0 && (
        <Card>
          <SectionHeading>Saves by Team</SectionHeading>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTeam('')}>
              <Badge variant={team === '' ? 'accent' : 'neutral'} className="cursor-pointer">
                All ({sportTeamCounts.reduce((sum, t) => sum + t.count, 0)})
              </Badge>
            </button>
            {sportTeamCounts.map((t) => (
              <button key={t.teamId} type="button" onClick={() => setTeam(team === t.teamId ? '' : t.teamId)}>
                <Badge variant={team === t.teamId ? 'accent' : 'neutral'} className="cursor-pointer">
                  {teamLabel(sport, t.teamId)} ({t.count})
                </Badge>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* Activity feed */}
      <Card>
        <SectionHeading
          actions={
            <div className="flex flex-wrap items-center gap-2">
              <Segmented
                options={[
                  { value: 'nhl', label: 'NHL' },
                  { value: 'mlb', label: 'MLB' },
                  { value: 'nfl', label: 'NFL' },
                ]}
                value={sport}
                onChange={(s) => { setSport(s); setTeam(''); setExpanded(null); }}
              />
              <Select
                value={team}
                onChange={(e) => { setTeam(e.target.value); setExpanded(null); }}
                className="w-auto"
              >
                <option value="">All teams</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.city} {t.name}
                  </option>
                ))}
              </Select>
            </div>
          }
        >
          Recent Saves
        </SectionHeading>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : saves.length === 0 ? (
          <EmptyState>
            {team
              ? `No saves yet for the ${teamLabel(sport, team)}.`
              : `No ${sport.toUpperCase()} saves yet. If picks were saved before this dashboard existed, run Backfill Index once.`}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Saved (ET)</Th>
                <Th>User</Th>
                <Th>Team</Th>
                <Th>Season</Th>
                <Th align="right">Picks</Th>
                <Th align="right">Record</Th>
                <Th align="right">{sport === 'nhl' ? 'Proj Pts' : 'Proj Wins'}</Th>
                <Th align="right">Odds</Th>
              </tr>
            </thead>
            <tbody>
              {saves.map((s) => {
                const rowKey = `${s.userId}:${s.sport}:${s.teamId}:${s.season}:${s.savedDate}`;
                const isOpen = expanded === rowKey;
                return (
                  <Fragment key={rowKey}>
                    <tr
                      className="cursor-pointer transition-colors hover:bg-gray-50"
                      onClick={() => setExpanded(isOpen ? null : rowKey)}
                    >
                      <Td className="text-gray-400">
                        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {formatSavedAt(s.savedAt, s.savedDate)}
                        {s.backdated && (
                          <Badge variant="warning" className="ml-1.5" title={`Entered later for ${s.savedDate}`}>
                            backdated
                          </Badge>
                        )}
                      </Td>
                      <Td>
                        <span className="font-semibold text-gray-900">{s.username}</span>
                        {s.email && <span className="block text-xs text-gray-400">{s.email}</span>}
                      </Td>
                      <Td className="whitespace-nowrap">
                        {teamLabel(s.sport as Sport, s.teamId)}
                        {s.label && <span className="block text-xs italic text-gray-400">&ldquo;{s.label}&rdquo;</span>}
                      </Td>
                      <Td className="whitespace-nowrap">{formatSeason(s.season)}</Td>
                      <Td align="right">{s.summary?.gamesPicked ?? s.picks.length}</Td>
                      <Td align="right" className="whitespace-nowrap">{s.summary?.record || '—'}</Td>
                      <Td align="right">{s.summary?.projectedPoints ?? '—'}</Td>
                      <Td align="right">
                        {s.sport !== 'nfl' && s.summary ? `${Math.round(s.summary.playoffOdds)}%` : '—'}
                      </Td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <Td colSpan={9} className="bg-gray-50">
                          <div className="flex flex-wrap gap-1.5 py-1 pl-6">
                            {s.picks.map((p) => (
                              <Badge key={p.gameId} variant={OUTCOME_BADGE[p.outcome] || 'neutral'} title={p.date}>
                                {p.isHome ? 'vs' : '@'} {p.opponentAbbrev} {p.outcome}
                              </Badge>
                            ))}
                          </div>
                        </Td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
