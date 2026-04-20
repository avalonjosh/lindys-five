'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import type { PlayoffSeries } from '@/lib/data/teamHistory';
import { TEAMS } from '@/lib/teamConfig';
import PlayoffGameRow from './PlayoffGameRow';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface PlayoffSeriesCardProps {
  seasonLabel: string;
  series: PlayoffSeries;
  teamColors: TeamColors;
  teamAbbreviation: string;
}

function opponentLogo(abbreviation: string): string | null {
  const cfg = Object.values(TEAMS).find((t) => t.abbreviation === abbreviation);
  return cfg?.logo ?? null;
}

export default function PlayoffSeriesCard({
  seasonLabel,
  series,
  teamColors,
  teamAbbreviation,
}: PlayoffSeriesCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const logo = opponentLogo(series.opponent.abbreviation);
  const resultLabel = series.result === 'won' ? 'Won' : 'Lost';
  const resultColor =
    series.result === 'won' ? 'text-emerald-600' : 'text-rose-600';

  return (
    <details
      className="group bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow overflow-hidden"
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none px-3 sm:px-5 py-3 sm:py-4 flex items-center gap-3 sm:gap-4">
        {logo && (
          <img
            src={logo}
            alt=""
            className="w-10 h-10 sm:w-12 sm:h-12 flex-shrink-0 object-contain"
            loading="lazy"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 sm:gap-3">
            <p
              className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500 truncate"
            >
              {series.roundLabel}
            </p>
            <p className="text-[11px] sm:text-xs font-semibold text-gray-400 flex-shrink-0">
              {seasonLabel}
            </p>
          </div>
          <div className="flex items-baseline justify-between gap-2 sm:gap-3 mt-0.5">
            <p className="text-sm sm:text-base font-bold text-gray-900 truncate">
              vs {series.opponent.name}
            </p>
            <p className={`text-sm sm:text-base font-bold ${resultColor} flex-shrink-0`}>
              {resultLabel} {series.wins}-{series.losses}
            </p>
          </div>
        </div>
        <ChevronDown
          size={20}
          className="text-gray-400 flex-shrink-0 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      {isOpen && (
        <div
          className="border-t border-gray-100 px-3 sm:px-5 py-4 sm:py-5 bg-gray-50/50"
          style={{ borderTopColor: teamColors.primary + '22' }}
        >
          {series.notes && (
            <p className="text-xs sm:text-sm text-gray-600 italic mb-4">
              {series.notes}
            </p>
          )}
          {series.games.length === 0 ? (
            <p className="text-xs sm:text-sm text-gray-500 text-center py-4">
              Game-by-game details coming soon.
            </p>
          ) : (
            (() => {
              // If the whole series has no video highlights, keep only Game 1's box score
              // expanded by default so users aren't flooded with stacked box scores.
              const seriesHasAnyVideo = series.games.some((g) => g.youtubeId || g.youtubePlaylistId);
              return (
                <div className="space-y-3">
                  {series.games.map((game, idx) => {
                    const defaultBoxscoreOpen = seriesHasAnyVideo
                      ? !game.youtubeId
                      : idx === 0;
                    return (
                      <PlayoffGameRow
                        key={game.gameNumber}
                        game={game}
                        teamAbbreviation={teamAbbreviation}
                        opponentAbbreviation={series.opponent.abbreviation}
                        defaultBoxscoreOpen={defaultBoxscoreOpen}
                      />
                    );
                  })}
                </div>
              );
            })()
          )}
        </div>
      )}
    </details>
  );
}
