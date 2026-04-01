import type { MLBGameResult } from '@/lib/types/mlb';
import { MLB_TEAMS } from '@/lib/teamConfig/mlbTeams';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface MLBLiveGameOverlayProps {
  game: MLBGameResult;
  gameNumber: number;
  teamAbbreviation: string;
  teamColors: TeamColors;
}

function getInningText(inning: number, half: 'Top' | 'Bot'): string {
  const ordinals = ['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th'];
  const ord = ordinals[inning] || `${inning}th`;
  return `${half === 'Top' ? 'Top' : 'Bot'} ${ord}`;
}

export default function MLBLiveGameOverlay({ game, gameNumber, teamAbbreviation, teamColors }: MLBLiveGameOverlayProps) {
  const inning = game.inning || 1;
  const inningHalf = game.inningHalf || 'Top';

  const opponentTeam = Object.values(MLB_TEAMS).find(t => t.abbreviation === game.opponent);
  const opponentSlug = opponentTeam?.id || null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border-2 shadow-lg transition-all duration-300 bg-gradient-to-br from-blue-50 to-slate-50 p-2.5 md:p-3"
      style={{ borderColor: teamColors.primary }}
    >
      {/* Game number and location */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-gray-500">#{gameNumber}</span>
        <span className="text-xs font-bold" style={{ color: teamColors.primary }}>
          {game.isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent with Logo */}
      <div className="text-center mb-2">
        <div className="text-xs font-semibold mb-1.5 text-gray-500">
          {game.isHome ? 'vs' : '@'}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {opponentSlug ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                window.location.href = `/mlb/${opponentSlug}`;
              }}
              className="rounded-lg p-3 md:p-3.5 shadow-sm border bg-white border-gray-200 transition-transform hover:scale-110 cursor-pointer"
              title={`View ${game.opponent} tracker`}
            >
              <img
                src={game.opponentLogo}
                alt={game.opponent}
                className="w-10 h-10 md:w-9 md:h-9 object-contain"
              />
            </button>
          ) : (
            <div className="rounded-lg p-3 md:p-3.5 shadow-sm border bg-white border-gray-200">
              <img
                src={game.opponentLogo}
                alt={game.opponent}
                className="w-10 h-10 md:w-9 md:h-9 object-contain"
              />
            </div>
          )}
          <div className="text-sm font-bold text-gray-800">{game.opponent}</div>
        </div>
      </div>

      {/* Score Display */}
      <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
        <div className="text-center">
          <div className="text-xs font-semibold mb-1 text-gray-500">{teamAbbreviation}</div>
          <div className="text-3xl font-bold text-gray-800">{game.teamScore}</div>
        </div>
        <div className="text-xl md:text-2xl font-light text-gray-400">-</div>
        <div className="text-center">
          <div className="text-xs font-semibold mb-1 text-gray-500">{game.opponent}</div>
          <div className="text-3xl font-bold text-gray-800">{game.opponentScore}</div>
        </div>
      </div>

      {/* Bottom Section — Inning + LIVE badge */}
      <div className="text-center pt-2 border-t-2 border-gray-200">
        <div className="text-sm font-bold" style={{ color: teamColors.primary }}>
          {getInningText(inning, inningHalf)}
        </div>
        <div className="mt-2 flex justify-center">
          <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-red-600 animate-pulse">
            LIVE
          </span>
        </div>
      </div>
    </div>
  );
}
