'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface TickerGame {
  id: number;
  gameState: string;
  startTimeUTC?: string;
  awayTeam: { abbrev: string; score: number; logo: string };
  homeTeam: { abbrev: string; score: number; logo: string };
  period?: { number: number; periodType: string };
  clock?: { timeRemaining: string; inIntermission: boolean };
  gameOutcome?: { lastPeriodType: string };
}

function formatTime(utc: string): string {
  return new Date(utc).toLocaleTimeString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getStatusLabel(game: TickerGame): { text: string; isLive: boolean } {
  const state = game.gameState;

  if (state === 'LIVE' || state === 'CRIT') {
    if (game.clock?.inIntermission) {
      return { text: `INT ${game.period?.number || ''}`, isLive: true };
    }
    const periodNum = game.period?.number || 1;
    const periodType = game.period?.periodType;
    const periodLabel = periodType === 'OT' ? 'OT' : periodType === 'SO' ? 'SO' : `P${periodNum}`;
    const time = game.clock?.timeRemaining || '';
    return { text: `${periodLabel} ${time}`, isLive: true };
  }

  if (state === 'FINAL' || state === 'OFF') {
    const ot = game.gameOutcome?.lastPeriodType;
    if (ot === 'OT') return { text: 'F/OT', isLive: false };
    if (ot === 'SO') return { text: 'F/SO', isLive: false };
    return { text: 'Final', isLive: false };
  }

  if (state === 'PRE') return { text: 'Pre-Game', isLive: false };

  // FUT — upcoming
  if (game.startTimeUTC) {
    return { text: formatTime(game.startTimeUTC), isLive: false };
  }
  return { text: 'TBD', isLive: false };
}

export default function GameTicker() {
  const [games, setGames] = useState<TickerGame[]>([]);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isPaused, setIsPaused] = useState(false);

  const fetchGames = useCallback(async () => {
    try {
      const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
      const res = await fetch(`/api/v1/schedule/${today}`);
      if (!res.ok) return;
      const data = await res.json();
      const gameWeek = data.gameWeek || [];
      const todayData = gameWeek.find((d: { date: string }) => d.date === today);
      const rawGames = todayData?.games || [];

      setGames(
        rawGames.map((g: any) => ({
          id: g.id,
          gameState: g.gameState,
          startTimeUTC: g.startTimeUTC,
          awayTeam: {
            abbrev: g.awayTeam?.abbrev || '',
            score: g.awayTeam?.score || 0,
            logo: g.awayTeam?.logo || '',
          },
          homeTeam: {
            abbrev: g.homeTeam?.abbrev || '',
            score: g.homeTeam?.score || 0,
            logo: g.homeTeam?.logo || '',
          },
          period: g.periodDescriptor
            ? { number: g.periodDescriptor.number, periodType: g.periodDescriptor.periodType }
            : undefined,
          clock: g.clock
            ? { timeRemaining: g.clock.timeRemaining, inIntermission: g.clock.inIntermission }
            : undefined,
          gameOutcome: g.gameOutcome || undefined,
        }))
      );
    } catch {
      // silent fail
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchGames();
    const interval = setInterval(fetchGames, 30000);
    return () => clearInterval(interval);
  }, [fetchGames]);

  // Auto-scroll
  useEffect(() => {
    if (isPaused || games.length === 0) return;
    const el = scrollRef.current;
    if (!el) return;

    const interval = setInterval(() => {
      if (el.scrollWidth <= el.clientWidth) return;
      if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 1) {
        el.scrollLeft = 0;
      } else {
        el.scrollLeft += 1;
      }
    }, 30);

    return () => clearInterval(interval);
  }, [isPaused, games]);

  if (loading || games.length === 0) return null;

  return (
    <div
      className="w-full overflow-hidden"
      style={{ background: '#0A1128' }}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={() => setIsPaused(true)}
      onTouchEnd={() => setTimeout(() => setIsPaused(false), 3000)}
    >
      <div
        ref={scrollRef}
        className="flex items-center gap-0 overflow-x-auto scrollbar-hide py-2 px-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {games.map((game) => {
          const status = getStatusLabel(game);
          const isFinal = game.gameState === 'FINAL' || game.gameState === 'OFF';
          const isUpcoming = game.gameState === 'FUT' || game.gameState === 'PRE';
          const awayWon = isFinal && game.awayTeam.score > game.homeTeam.score;
          const homeWon = isFinal && game.homeTeam.score > game.awayTeam.score;

          return (
            <Link
              key={game.id}
              href={`/nhl/scores/${game.id}`}
              className="flex items-center gap-2 px-3 py-1 border-r border-white/10 last:border-r-0 hover:bg-white/5 transition-colors shrink-0"
            >
              {/* Away Team */}
              <div className="flex items-center gap-1.5">
                <img src={game.awayTeam.logo} alt={game.awayTeam.abbrev} className="w-5 h-5 object-contain" />
                <span className={`text-xs font-semibold ${awayWon ? 'text-white' : isFinal ? 'text-gray-500' : 'text-gray-300'}`}>
                  {game.awayTeam.abbrev}
                </span>
                {!isUpcoming && (
                  <span className={`text-sm font-bold tabular-nums ${awayWon ? 'text-white' : isFinal ? 'text-gray-500' : 'text-white'}`}>
                    {game.awayTeam.score}
                  </span>
                )}
              </div>

              {/* Status */}
              <div className="flex flex-col items-center mx-1">
                {status.isLive && (
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse mb-0.5" />
                )}
                <span className={`text-[10px] font-semibold whitespace-nowrap ${
                  status.isLive ? 'text-green-400' : isFinal ? 'text-gray-500' : 'text-gray-400'
                }`}>
                  {status.text}
                </span>
              </div>

              {/* Home Team */}
              <div className="flex items-center gap-1.5">
                {!isUpcoming && (
                  <span className={`text-sm font-bold tabular-nums ${homeWon ? 'text-white' : isFinal ? 'text-gray-500' : 'text-white'}`}>
                    {game.homeTeam.score}
                  </span>
                )}
                <span className={`text-xs font-semibold ${homeWon ? 'text-white' : isFinal ? 'text-gray-500' : 'text-gray-300'}`}>
                  {game.homeTeam.abbrev}
                </span>
                <img src={game.homeTeam.logo} alt={game.homeTeam.abbrev} className="w-5 h-5 object-contain" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
