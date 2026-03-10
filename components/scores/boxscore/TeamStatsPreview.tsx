'use client';

import type { TeamSeasonStats, Last10Record } from '@/lib/types/boxscore';
import { TEAMS } from '@/lib/teamConfig';

interface TeamStatsPreviewProps {
  teamSeasonStats: {
    awayTeam: TeamSeasonStats;
    homeTeam: TeamSeasonStats;
  };
  last10Record: {
    awayTeam: Last10Record;
    homeTeam: Last10Record;
  };
  homeAbbrev: string;
  awayAbbrev: string;
}

function getTeamColor(abbrev: string): string {
  const team = Object.values(TEAMS).find(t => t.abbreviation === abbrev);
  return team?.colors.primary ?? '#3b82f6';
}

interface StatBarProps {
  label: string;
  awayValue: string;
  homeValue: string;
  awayRank?: number;
  homeRank?: number;
  awayNum: number;
  homeNum: number;
  awayColor: string;
  homeColor: string;
  lowerIsBetter?: boolean;
}

function StatBar({ label, awayValue, homeValue, awayRank, homeRank, awayNum, homeNum, awayColor, homeColor, lowerIsBetter }: StatBarProps) {
  const total = awayNum + homeNum;
  let awayPct = 50;
  let homePct = 50;

  if (total > 0) {
    awayPct = (awayNum / total) * 100;
    homePct = (homeNum / total) * 100;
  }

  // If lower is better, invert the bar so better team gets more bar
  if (lowerIsBetter && total > 0) {
    awayPct = (homeNum / total) * 100;
    homePct = (awayNum / total) * 100;
  }

  const minPct = 15;
  if (awayPct < minPct && total > 0) {
    awayPct = minPct;
    homePct = 100 - minPct;
  } else if (homePct < minPct && total > 0) {
    homePct = minPct;
    awayPct = 100 - minPct;
  }

  const awayBetter = lowerIsBetter ? awayNum < homeNum : awayNum > homeNum;
  const homeBetter = lowerIsBetter ? homeNum < awayNum : homeNum > awayNum;

  return (
    <div>
      <p className="text-xs text-gray-500 text-center mb-1.5">{label}</p>
      <div className="flex items-center gap-3">
        <div className="w-20 text-right shrink-0">
          <span className={`text-sm tabular-nums ${awayBetter ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>
            {awayValue}
          </span>
          {awayRank !== undefined && (
            <span className="text-[10px] text-gray-400 ml-1">#{awayRank}</span>
          )}
        </div>
        <div className="flex-1 flex h-2.5 rounded-full overflow-hidden bg-gray-100">
          <div
            className="h-full rounded-l-full transition-all duration-500"
            style={{ width: `${awayPct}%`, backgroundColor: awayColor, opacity: awayBetter ? 1 : 0.5 }}
          />
          <div
            className="h-full rounded-r-full transition-all duration-500"
            style={{ width: `${homePct}%`, backgroundColor: homeColor, opacity: homeBetter ? 1 : 0.5 }}
          />
        </div>
        <div className="w-20 shrink-0">
          <span className={`text-sm tabular-nums ${homeBetter ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`}>
            {homeValue}
          </span>
          {homeRank !== undefined && (
            <span className="text-[10px] text-gray-400 ml-1">#{homeRank}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function getStreakDisplay(record: Last10Record): string {
  const type = record.streakType === 'W' ? 'W' : record.streakType === 'L' ? 'L' : 'OT';
  return `${type}${record.streak}`;
}

function getResultColor(result: string): string {
  if (result === 'W' || result === 'OTW' || result === 'SOW') return 'bg-green-500';
  if (result === 'L') return 'bg-red-500';
  return 'bg-yellow-500'; // OTL, SOL
}

export default function TeamStatsPreview({
  teamSeasonStats,
  last10Record,
  homeAbbrev,
  awayAbbrev,
}: TeamStatsPreviewProps) {
  if (!teamSeasonStats || !last10Record) return null;

  const away = teamSeasonStats.awayTeam;
  const home = teamSeasonStats.homeTeam;
  const awayColor = getTeamColor(awayAbbrev);
  const homeColor = getTeamColor(homeAbbrev);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Team Comparison</h3>

      {/* Team headers */}
      <div className="flex items-center justify-between mb-4 px-1">
        <span className="text-xs font-bold text-gray-600">{awayAbbrev}</span>
        <span className="text-xs font-bold text-gray-600">{homeAbbrev}</span>
      </div>

      <div className="space-y-4">
        <StatBar
          label="Power Play"
          awayValue={`${(away.ppPctg * 100).toFixed(1)}%`}
          homeValue={`${(home.ppPctg * 100).toFixed(1)}%`}
          awayRank={away.ppPctgRank}
          homeRank={home.ppPctgRank}
          awayNum={away.ppPctg}
          homeNum={home.ppPctg}
          awayColor={awayColor}
          homeColor={homeColor}
        />
        <StatBar
          label="Penalty Kill"
          awayValue={`${(away.pkPctg * 100).toFixed(1)}%`}
          homeValue={`${(home.pkPctg * 100).toFixed(1)}%`}
          awayRank={away.pkPctgRank}
          homeRank={home.pkPctgRank}
          awayNum={away.pkPctg}
          homeNum={home.pkPctg}
          awayColor={awayColor}
          homeColor={homeColor}
        />
        <StatBar
          label="Faceoff %"
          awayValue={`${(away.faceoffWinningPctg * 100).toFixed(1)}%`}
          homeValue={`${(home.faceoffWinningPctg * 100).toFixed(1)}%`}
          awayRank={away.faceoffWinningPctgRank}
          homeRank={home.faceoffWinningPctgRank}
          awayNum={away.faceoffWinningPctg}
          homeNum={home.faceoffWinningPctg}
          awayColor={awayColor}
          homeColor={homeColor}
        />
        <StatBar
          label="Goals For / Game"
          awayValue={away.goalsForPerGamePlayed.toFixed(2)}
          homeValue={home.goalsForPerGamePlayed.toFixed(2)}
          awayRank={away.goalsForPerGamePlayedRank}
          homeRank={home.goalsForPerGamePlayedRank}
          awayNum={away.goalsForPerGamePlayed}
          homeNum={home.goalsForPerGamePlayed}
          awayColor={awayColor}
          homeColor={homeColor}
        />
        <StatBar
          label="Goals Against / Game"
          awayValue={away.goalsAgainstPerGamePlayed.toFixed(2)}
          homeValue={home.goalsAgainstPerGamePlayed.toFixed(2)}
          awayRank={away.goalsAgainstPerGamePlayedRank}
          homeRank={home.goalsAgainstPerGamePlayedRank}
          awayNum={away.goalsAgainstPerGamePlayed}
          homeNum={home.goalsAgainstPerGamePlayed}
          awayColor={awayColor}
          homeColor={homeColor}
          lowerIsBetter
        />
      </div>

      {/* Last 10 / Recent Form */}
      <div className="border-t border-gray-100 mt-5 pt-4">
        <h4 className="text-xs font-semibold text-gray-500 text-center mb-3 uppercase tracking-wide">Last 10 Games</h4>
        <div className="grid grid-cols-2 gap-4">
          {/* Away last 10 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm font-bold text-gray-900">{last10Record.awayTeam.record}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                last10Record.awayTeam.streakType === 'W' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {getStreakDisplay(last10Record.awayTeam)}
              </span>
            </div>
            <div className="flex items-center justify-center gap-0.5">
              {last10Record.awayTeam.pastGameResults.slice(0, 10).map((result, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${getResultColor(result.gameResult)}`}
                  title={`vs ${result.opponentAbbrev}: ${result.gameResult}`}
                />
              ))}
            </div>
          </div>

          {/* Home last 10 */}
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-sm font-bold text-gray-900">{last10Record.homeTeam.record}</span>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                last10Record.homeTeam.streakType === 'W' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                {getStreakDisplay(last10Record.homeTeam)}
              </span>
            </div>
            <div className="flex items-center justify-center gap-0.5">
              {last10Record.homeTeam.pastGameResults.slice(0, 10).map((result, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${getResultColor(result.gameResult)}`}
                  title={`vs ${result.opponentAbbrev}: ${result.gameResult}`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
