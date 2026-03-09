'use client';

import { useState, useEffect } from 'react';
import { Ticket } from 'lucide-react';
import { generateStubHubLink } from '@/lib/utils/affiliateLinks';
import { TEAMS } from '@/lib/teamConfig';

interface NextGame {
  id: number;
  date: string;
  time: string;
  opponent: string;
  opponentAbbrev: string;
  isHome: boolean;
  venue: string;
  homeTeamAbbrev: string;
}

interface NextGameCTAProps {
  team: 'sabres' | 'bills';
  primaryColor: string;
  accentColor: string;
}

export default function NextGameCTA({ team, primaryColor, accentColor }: NextGameCTAProps) {
  const [nextGame, setNextGame] = useState<NextGame | null>(null);

  useEffect(() => {
    async function fetchNextGame() {
      if (team !== 'sabres') return;

      try {
        const today = new Date().toISOString().split('T')[0];
        const response = await fetch(
          `/api/nhl/schedule?team=BUF&date=${today}`
        );
        if (!response.ok) return;

        const data = await response.json();
        const games = data.games || [];

        // Find next upcoming game (not started yet)
        const upcoming = games.find((g: { gameState: string }) =>
          g.gameState === 'FUT' || g.gameState === 'PRE'
        );

        if (upcoming) {
          const gameDate = new Date(upcoming.startTimeUTC);
          const isHome = upcoming.homeTeam.abbrev === 'BUF';
          const opponent = isHome ? upcoming.awayTeam : upcoming.homeTeam;

          setNextGame({
            id: upcoming.id,
            date: gameDate.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            }),
            time: gameDate.toLocaleTimeString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
            }),
            opponent: opponent.placeName?.default || opponent.abbrev,
            opponentAbbrev: opponent.abbrev,
            isHome,
            venue: upcoming.venue?.default || (isHome ? 'KeyBank Center' : 'Away'),
            homeTeamAbbrev: upcoming.homeTeam.abbrev,
          });
        }
      } catch {
        // Silently fail - next game section just won't show
      }
    }

    fetchNextGame();
  }, [team]);

  if (!nextGame) return null;

  // Get the venue team (home team) for ticket link
  const venueTeam = Object.values(TEAMS).find(t => t.abbreviation === nextGame.homeTeamAbbrev);
  if (!venueTeam) return null;

  return (
    <div className="mt-8">
      <a
        href={generateStubHubLink({
          stubhubId: venueTeam.stubhubId,
          trackingRef: `article-${nextGame.homeTeamAbbrev.toLowerCase()}-vs-${nextGame.isHome ? nextGame.opponentAbbrev.toLowerCase() : 'buf'}`,
          teamSlug: venueTeam.slug,
          teamCity: venueTeam.city,
        })}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-2xl p-5 shadow-lg border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl bg-white"
        style={{ borderColor: accentColor }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: primaryColor }}
            >
              <Ticket className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Next Game
              </p>
              <h3
                className="text-xl font-bold mb-0.5"
                style={{ color: primaryColor, fontFamily: 'Bebas Neue, sans-serif' }}
              >
                {nextGame.isHome ? 'BUF' : nextGame.opponentAbbrev} vs {nextGame.isHome ? nextGame.opponentAbbrev : 'BUF'}
              </h3>
              <p className="text-sm text-gray-600">
                {nextGame.date} &bull; {nextGame.time}
              </p>
            </div>
          </div>
          <div
            className="px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{ backgroundColor: primaryColor }}
          >
            Get Tickets
          </div>
        </div>
      </a>
    </div>
  );
}
