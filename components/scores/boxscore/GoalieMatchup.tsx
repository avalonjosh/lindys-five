'use client';

import type { GoalieComparison } from '@/lib/types/boxscore';

interface GoalieMatchupProps {
  goalieComparison: GoalieComparison;
  homeAbbrev: string;
  awayAbbrev: string;
}

function StatRow({ label, away, home, better }: { label: string; away: string; home: string; better?: 'away' | 'home' | null }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className={`text-xs tabular-nums w-12 sm:w-16 text-left ${better === 'away' ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {away}
      </span>
      <span className="text-xs text-gray-400 flex-1 text-center">{label}</span>
      <span className={`text-xs tabular-nums w-12 sm:w-16 text-right ${better === 'home' ? 'font-bold text-gray-900' : 'text-gray-500'}`}>
        {home}
      </span>
    </div>
  );
}

function compareLower(a: number, b: number): 'away' | 'home' | null {
  if (a < b) return 'away';
  if (b < a) return 'home';
  return null;
}

function compareHigher(a: number, b: number): 'away' | 'home' | null {
  if (a > b) return 'away';
  if (b > a) return 'home';
  return null;
}

export default function GoalieMatchup({
  goalieComparison,
  homeAbbrev,
  awayAbbrev,
}: GoalieMatchupProps) {
  if (!goalieComparison) return null;

  const awayStarter = goalieComparison.awayTeam.leaders?.[0];
  const homeStarter = goalieComparison.homeTeam.leaders?.[0];

  if (!awayStarter || !homeStarter) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-700">Goalie Matchup</h3>
        <span className="text-xs text-gray-400">Season Stats</span>
      </div>

      {/* Goalie headshots and names */}
      <div className="flex items-center justify-between mb-4">
        {/* Away goalie */}
        <div className="flex items-center gap-2">
          <img
            src={awayStarter.headshot}
            alt={awayStarter.name.default}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100"
          />
          <div>
            <p className="text-xs font-semibold text-gray-800">{awayStarter.lastName.default}</p>
            <p className="text-[10px] text-gray-400">#{awayStarter.sweaterNumber} {awayAbbrev}</p>
          </div>
        </div>

        <span className="text-xs text-gray-300 font-medium">VS</span>

        {/* Home goalie */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-semibold text-gray-800">{homeStarter.lastName.default}</p>
            <p className="text-[10px] text-gray-400">{homeAbbrev} #{homeStarter.sweaterNumber}</p>
          </div>
          <img
            src={homeStarter.headshot}
            alt={homeStarter.name.default}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-gray-100"
          />
        </div>
      </div>

      {/* Stats comparison */}
      <div className="border-t border-gray-100 pt-3">
        <StatRow
          label="Record"
          away={awayStarter.record}
          home={homeStarter.record}
        />
        <StatRow
          label="GAA"
          away={awayStarter.gaa != null ? awayStarter.gaa.toFixed(2) : '—'}
          home={homeStarter.gaa != null ? homeStarter.gaa.toFixed(2) : '—'}
          better={awayStarter.gaa != null && homeStarter.gaa != null ? compareLower(awayStarter.gaa, homeStarter.gaa) : null}
        />
        <StatRow
          label="SV%"
          away={awayStarter.savePctg != null ? awayStarter.savePctg.toFixed(3) : '—'}
          home={homeStarter.savePctg != null ? homeStarter.savePctg.toFixed(3) : '—'}
          better={awayStarter.savePctg != null && homeStarter.savePctg != null ? compareHigher(awayStarter.savePctg, homeStarter.savePctg) : null}
        />
        <StatRow
          label="SO"
          away={String(awayStarter.shutouts)}
          home={String(homeStarter.shutouts)}
          better={compareHigher(awayStarter.shutouts, homeStarter.shutouts)}
        />
        <StatRow
          label="GP"
          away={String(awayStarter.gamesPlayed)}
          home={String(homeStarter.gamesPlayed)}
        />
      </div>
    </div>
  );
}
