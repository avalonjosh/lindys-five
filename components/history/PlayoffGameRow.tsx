'use client';

import type { PlayoffGame } from '@/lib/data/teamHistory';
import YouTubeEmbed from './YouTubeEmbed';
import InlineBoxscore from './InlineBoxscore';

interface PlayoffGameRowProps {
  game: PlayoffGame;
  teamAbbreviation: string;
  opponentAbbreviation: string;
  defaultBoxscoreOpen?: boolean;
}

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function locationLabel(location: PlayoffGame['location']): string {
  if (location === 'home') return 'Home';
  if (location === 'away') return 'Away';
  return 'Neutral';
}

export default function PlayoffGameRow({
  game,
  teamAbbreviation,
  opponentAbbreviation,
  defaultBoxscoreOpen,
}: PlayoffGameRowProps) {
  const won = game.teamScore > game.opponentScore;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
        <div className="flex items-baseline gap-2 sm:gap-3 flex-wrap min-w-0">
          <p className="text-xs sm:text-sm font-bold text-gray-900">
            Game {game.gameNumber}
          </p>
          <p className="text-[11px] sm:text-xs text-gray-500">
            {formatGameDate(game.date)}
          </p>
          <p className="text-[11px] sm:text-xs text-gray-500">
            {locationLabel(game.location)}
          </p>
          {game.overtime && (
            <span className="inline-flex items-center text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-2 py-0.5">
              {game.overtimePeriods && game.overtimePeriods > 1 ? `${game.overtimePeriods}OT` : 'OT'}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-gray-500">
              {teamAbbreviation}
            </span>
            <span
              className={`text-base sm:text-lg font-bold ${
                won ? 'text-emerald-600' : 'text-rose-600'
              }`}
            >
              {game.teamScore}
            </span>
          </div>
          <span className="text-gray-400 text-sm">–</span>
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] sm:text-xs font-semibold tracking-wider text-gray-500">
              {opponentAbbreviation}
            </span>
            <span className="text-base sm:text-lg font-bold text-gray-700">
              {game.opponentScore}
            </span>
          </div>
        </div>
      </div>

      {game.notes && (
        <p className="text-xs sm:text-sm text-gray-600 mt-2">{game.notes}</p>
      )}

      {game.youtubeId && (
        <div className="mt-3">
          <YouTubeEmbed
            videoId={game.youtubeId}
            playlistId={game.youtubePlaylistId}
            title={`Game ${game.gameNumber} highlights — ${formatGameDate(game.date)}`}
          />
        </div>
      )}

      {game.gameId && (
        <InlineBoxscore
          gameId={game.gameId}
          defaultOpen={defaultBoxscoreOpen ?? !game.youtubeId}
        />
      )}
    </div>
  );
}
