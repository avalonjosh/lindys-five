'use client';

import type { PlayoffAppearance } from '@/lib/data/teamHistory';
import PlayoffSeriesCard from './PlayoffSeriesCard';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface PlayoffTimelineProps {
  appearances: PlayoffAppearance[];
  teamColors: TeamColors;
  teamAbbreviation: string;
}

function finalOutcomeLabel(a: PlayoffAppearance): string {
  if (a.madeStanleyCupFinal) {
    const final = a.series[a.series.length - 1];
    return final?.result === 'won'
      ? 'Won the Stanley Cup'
      : 'Lost in the Stanley Cup Final';
  }
  const roundNames: Record<number, string> = {
    1: 'First Round',
    2: 'Second Round',
    3: 'Conference Final',
  };
  const last = a.series[a.series.length - 1];
  const result = last?.result === 'won' ? 'Advanced past' : 'Lost in';
  return `${result} ${roundNames[a.finalRoundReached] ?? `Round ${a.finalRoundReached}`}`;
}

export default function PlayoffTimeline({
  appearances,
  teamColors,
  teamAbbreviation,
}: PlayoffTimelineProps) {
  if (appearances.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        No playoff appearances on record yet.
      </div>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      {appearances.map((appearance) => (
        <section key={appearance.season} aria-labelledby={`season-${appearance.season}`}>
          <div className="flex items-baseline justify-between gap-3 mb-2 sm:mb-3 px-1">
            <h2
              id={`season-${appearance.season}`}
              className="text-xl sm:text-2xl font-bold text-gray-900"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {appearance.seasonLabel}
            </h2>
            <p className="text-xs sm:text-sm font-medium text-gray-500 text-right">
              {finalOutcomeLabel(appearance)}
            </p>
          </div>
          <div className="space-y-2">
            {appearance.series.map((series) => (
              <PlayoffSeriesCard
                key={`${appearance.season}-r${series.round}`}
                seasonLabel={appearance.seasonLabel}
                series={series}
                teamColors={teamColors}
                teamAbbreviation={teamAbbreviation}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
