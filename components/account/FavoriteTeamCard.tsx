'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { findTeam, getTeamUrl } from '@/lib/teamConfig';
import { fetchSabresSchedule } from '@/lib/services/nhlApi';
import { fetchMLBSchedule, fetchMLBStandings } from '@/lib/services/mlbApi';
import { fetchNFLSchedule } from '@/lib/services/nflApi';
import { getMLBPlayoffProbability } from '@/lib/utils/mlbStandingsCalc';
import { getCurrentNHLSeason, nextNHLSeason, formatSeasonLabel } from '@/lib/utils/season';

interface NextGame {
  date: string;
  opponent: string;
  isHome: boolean;
}

type Snapshot =
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'mlb'; wins: number; losses: number; probability: number | null; next: NextGame | null }
  | { kind: 'nfl'; wins: number; losses: number; next: NextGame | null }
  | { kind: 'nhl-live'; wins: number; losses: number; otl: number; points: number; next: NextGame | null }
  | { kind: 'nhl-preseason'; seasonLabel: string; opener: NextGame | null; daysUntil: number | null }
  | { kind: 'nhl-complete'; seasonLabel: string; wins: number; losses: number; otl: number; points: number };

/** "MM/DD/YYYY" (NHL) or "Jul 20" (MLB) → short display label. */
function gameDateLabel(date: string): string {
  const us = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!us) return date;
  return new Date(`${us[3]}-${us[1]}-${us[2]}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function daysUntil(date: string): number | null {
  const us = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  const target = new Date(`${us ? `${us[3]}-${us[1]}-${us[2]}` : date}T12:00:00`);
  if (isNaN(target.getTime())) return null;
  return Math.max(0, Math.ceil((target.getTime() - Date.now()) / 86400000));
}

const nextGameLabel = (g: NextGame) => `${g.isHome ? 'vs' : '@'} ${g.opponent} · ${gameDateLabel(g.date)}`;

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-sm font-bold text-gray-900" style={color ? { color } : undefined}>{value}</div>
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
    </div>
  );
}

/** Overview snapshot of the user's favorite team: record, odds, next game. */
export default function FavoriteTeamCard({ teamSlug }: { teamSlug: string }) {
  const [snap, setSnap] = useState<Snapshot>({ kind: 'loading' });
  const team = findTeam(teamSlug);

  useEffect(() => {
    if (!team) return;
    let cancelled = false;
    const done = (s: Snapshot) => { if (!cancelled) setSnap(s); };

    (async () => {
      try {
        // TeamConfig declares sport as a union, so narrow structurally.
        if ('mlbId' in team) {
          const year = new Date().getFullYear();
          const [schedule, standings] = await Promise.all([
            fetchMLBSchedule(team.mlbId, year),
            fetchMLBStandings().catch(() => []),
          ]);
          if (schedule.length === 0) return done({ kind: 'unavailable' });
          const wins = schedule.filter(g => g.outcome === 'W').length;
          const losses = schedule.filter(g => g.outcome === 'L').length;
          const nextGame = schedule.find(g => g.outcome === 'PENDING');
          const row = standings.find(t => t.teamAbbrev === team.abbreviation);
          return done({
            kind: 'mlb',
            wins,
            losses,
            probability: row ? getMLBPlayoffProbability(row, standings).probability : null,
            next: nextGame ? { date: nextGame.date, opponent: nextGame.opponent, isHome: nextGame.isHome } : null,
          });
        }

        if ('espnId' in team) {
          // NFL favorite: record + next game. Pre-season shows the opener countdown.
          const { games } = await fetchNFLSchedule(team.abbreviation, new Date().getFullYear());
          if (games.length === 0) return done({ kind: 'unavailable' });
          const wins = games.filter(g => g.outcome === 'W').length;
          const losses = games.filter(g => g.outcome === 'L').length;
          const nextGame = games.find(g => g.outcome === 'PENDING');
          if (wins + losses === 0 && nextGame) {
            return done({
              kind: 'nhl-preseason',
              seasonLabel: '2026 NFL',
              opener: { date: nextGame.date, opponent: nextGame.opponent, isHome: nextGame.isHome },
              daysUntil: daysUntil(nextGame.isoDate),
            });
          }
          return done({
            kind: 'nfl',
            wins,
            losses,
            next: nextGame ? { date: nextGame.date, opponent: nextGame.opponent, isHome: nextGame.isHome } : null,
          });
        }

        // NHL: date-based season first; if it's fully played, look for the next
        // season's schedule (preseason preview), mirroring the tracker pages.
        const season = getCurrentNHLSeason();
        const schedule = await fetchSabresSchedule(season, team.abbreviation, team.nhlId);
        if (schedule.length === 0) return done({ kind: 'unavailable' });
        const record = (games: typeof schedule) => ({
          wins: games.filter(g => g.outcome === 'W').length,
          losses: games.filter(g => g.outcome === 'L').length,
          otl: games.filter(g => g.outcome === 'OTL').length,
          points: games.reduce((s, g) => s + (g.outcome !== 'PENDING' ? g.points : 0), 0),
        });
        const pending = schedule.filter(g => g.outcome === 'PENDING');

        if (pending.length === 0) {
          const upcoming = nextNHLSeason(season);
          const nextSchedule = await fetchSabresSchedule(upcoming, team.abbreviation, team.nhlId).catch(() => []);
          if (nextSchedule.length > 0) {
            const opener = nextSchedule[0];
            return done({
              kind: 'nhl-preseason',
              seasonLabel: formatSeasonLabel(upcoming),
              opener: { date: opener.date, opponent: opener.opponentAbbreviation || opener.opponent, isHome: opener.isHome },
              daysUntil: daysUntil(opener.date),
            });
          }
          return done({ kind: 'nhl-complete', seasonLabel: formatSeasonLabel(season), ...record(schedule) });
        }

        if (pending.length === schedule.length) {
          const opener = pending[0];
          return done({
            kind: 'nhl-preseason',
            seasonLabel: formatSeasonLabel(season),
            opener: { date: opener.date, opponent: opener.opponentAbbreviation || opener.opponent, isHome: opener.isHome },
            daysUntil: daysUntil(opener.date),
          });
        }

        const nextGame = pending[0];
        return done({
          kind: 'nhl-live',
          ...record(schedule),
          next: { date: nextGame.date, opponent: nextGame.opponentAbbreviation || nextGame.opponent, isHome: nextGame.isHome },
        });
      } catch {
        done({ kind: 'unavailable' });
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamSlug]);

  if (!team || snap.kind === 'unavailable') return null;

  return (
    <section className="mb-4 overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl">
      {/* Team-tinted header strip, same treatment as the picks group headers */}
      <div
        className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3"
        style={{ backgroundColor: `${team.colors.primary}0d` }}
      >
        <div className="flex min-w-0 items-center gap-2">
          <Image src={team.logo} alt="" width={24} height={24} className="h-6 w-6 flex-shrink-0" unoptimized />
          <h3 className="truncate text-sm font-bold text-gray-900">{team.city} {team.name}</h3>
        </div>
        <Link href={getTeamUrl(teamSlug)} className="flex-shrink-0 text-xs font-bold hover:underline" style={{ color: team.colors.primary }}>
          View tracker →
        </Link>
      </div>

      <div className="p-4">
      {snap.kind === 'loading' ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : snap.kind === 'mlb' ? (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Record" value={`${snap.wins}-${snap.losses}`} />
          <Stat label="Playoff Odds" value={snap.probability != null ? `${snap.probability}%` : '—'} color={team.colors.primary} />
          <Stat label="Next Game" value={snap.next ? nextGameLabel(snap.next) : '—'} />
        </div>
      ) : snap.kind === 'nfl' ? (
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Record" value={`${snap.wins}-${snap.losses}`} color={team.colors.primary} />
          <Stat label="Next Game" value={snap.next ? nextGameLabel(snap.next) : '—'} />
        </div>
      ) : snap.kind === 'nhl-live' ? (
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Record" value={`${snap.wins}-${snap.losses}-${snap.otl}`} />
          <Stat label="Points" value={String(snap.points)} color={team.colors.primary} />
          <Stat label="Next Game" value={snap.next ? nextGameLabel(snap.next) : '—'} />
        </div>
      ) : snap.kind === 'nhl-preseason' ? (
        <p className="text-sm text-gray-600">
          The {snap.seasonLabel} season opener is{' '}
          {snap.opener ? (
            <>
              <span className="font-bold text-gray-900">{nextGameLabel(snap.opener)}</span>
              {snap.daysUntil != null && snap.daysUntil > 0 && (
                <span className="font-semibold" style={{ color: team.colors.primary }}> · in {snap.daysUntil} days</span>
              )}
            </>
          ) : (
            'coming soon'
          )}
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <Stat label={`${snap.seasonLabel} Final`} value={`${snap.wins}-${snap.losses}-${snap.otl}`} />
          <Stat label="Points" value={String(snap.points)} color={team.colors.primary} />
          <Stat label="Status" value="Season complete" />
        </div>
      )}
      </div>
    </section>
  );
}
