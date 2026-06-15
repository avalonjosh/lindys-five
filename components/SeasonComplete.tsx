'use client';

import type { SeasonSummary } from '@/lib/utils/seasonSummary';
import { playoffResultText } from '@/lib/utils/seasonSummary';

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

interface DarkModeColors {
  background: string;
  backgroundGradient?: string;
  cardBackground?: string;
  accent: string;
  border: string;
  text: string;
}

interface SeasonCompleteProps {
  summary: SeasonSummary;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export default function SeasonComplete({
  summary,
  teamColors,
  darkModeColors,
  isGoatMode,
}: SeasonCompleteProps) {
  const { finalRecord, divisionName, divisionFinish, conferenceName, conferenceFinish, playoff } = summary;

  const labelStyle = isGoatMode ? { color: darkModeColors.accent } : { color: teamColors.primary };
  const valueColor = isGoatMode ? 'text-white' : 'text-gray-900';
  const subColor = isGoatMode ? 'text-zinc-400' : 'text-gray-600';

  // Playoff outcome accent: gold for Cup, green for made, red for missed.
  const outcomeColor = playoff.wonCup ? '#D4AF37' : playoff.made ? '#16a34a' : '#dc2626';
  const resultText = playoffResultText(summary);

  const tileClass = `rounded-xl p-2 md:p-3 border ${
    isGoatMode
      ? 'bg-gradient-to-br from-zinc-800 to-zinc-900 border-zinc-700'
      : 'bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200'
  }`;
  const tileLabel = `text-xs font-semibold uppercase tracking-wide mb-1`;

  return (
    <div
      className={`rounded-2xl p-3 md:p-4 shadow-xl mb-4 border-2 ${
        isGoatMode ? '' : 'bg-white border-gray-200'
      }`}
      style={
        isGoatMode
          ? {
              backgroundColor: darkModeColors.cardBackground || darkModeColors.background,
              borderColor: darkModeColors.border,
            }
          : undefined
      }
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className={`text-xl md:text-2xl font-bold ${valueColor}`}>
          {summary.seasonLabel} Season Complete
        </h3>
        <span
          className="text-xs md:text-sm font-bold px-3 py-1 rounded-full whitespace-nowrap"
          style={{ backgroundColor: `${outcomeColor}1A`, color: outcomeColor }}
        >
          {playoff.wonCup ? '🏆 Stanley Cup Champions' : playoff.made ? 'Made Playoffs' : 'Missed Playoffs'}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3 mb-3">
        {/* Final Record */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Final Record</div>
          {finalRecord ? (
            <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
              {finalRecord.wins}-{finalRecord.losses}-{finalRecord.otLosses}
            </div>
          ) : (
            <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>—</div>
          )}
          <div className={`text-xs mt-1 ${subColor}`}>
            {finalRecord ? `${finalRecord.gamesPlayed} games` : 'regular season'}
          </div>
        </div>

        {/* Points */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Points</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
            {finalRecord ? finalRecord.points : '—'}
          </div>
          <div className={`text-xs mt-1 ${subColor}`}>final total</div>
        </div>

        {/* Division Finish */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Division</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
            {divisionFinish ? ordinal(divisionFinish) : '—'}
          </div>
          <div className={`text-xs mt-1 ${subColor}`}>{divisionName || 'division'}</div>
        </div>

        {/* Conference Finish */}
        <div className={tileClass}>
          <div className={tileLabel} style={labelStyle}>Conference</div>
          <div className={`text-2xl md:text-3xl font-bold ${valueColor}`}>
            {conferenceFinish ? ordinal(conferenceFinish) : '—'}
          </div>
          <div className={`text-xs mt-1 ${subColor}`}>{conferenceName || 'conference'}</div>
        </div>
      </div>

      {/* Playoff result line */}
      <div
        className="rounded-lg px-3 py-2 text-sm md:text-base font-semibold text-center"
        style={{ backgroundColor: `${outcomeColor}14`, color: outcomeColor }}
      >
        {resultText}
      </div>
    </div>
  );
}
