'use client';

import { useState, useEffect } from 'react';
import type { MLBBoxScoreData } from '@/lib/types/mlb';
import { fetchMLBBoxScore } from '@/lib/services/mlbApi';
import MLBGameHeader from './MLBGameHeader';
import MLBScoringPlays from './MLBScoringPlays';
import MLBBattingStats from './MLBBattingStats';
import MLBPitchingStats from './MLBPitchingStats';
import MLBProbablePitchers from './MLBProbablePitchers';
import MLBTeamComparison from './MLBTeamComparison';
import MLBStandingsContext from './MLBStandingsContext';
import MLBRecentForm from './MLBRecentForm';
import MLBSeasonSeries from './MLBSeasonSeries';

interface Props {
  gameId: string;
}

export default function MLBBoxScoreClient({ gameId }: Props) {
  const [data, setData] = useState<MLBBoxScoreData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const loadData = async () => {
    try {
      const result = await fetchMLBBoxScore(parseInt(gameId));
      setData(result);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [gameId]);

  // Poll for live games
  useEffect(() => {
    if (!data) return;
    const isLive = data.status === 'In Progress' || data.status === 'Warming Up';
    if (!isLive) return;
    const interval = setInterval(() => loadData(), 15000);
    return () => clearInterval(interval);
  }, [data?.status]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-blue-500" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Failed to load box score.</p>
          <button onClick={loadData} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Retry</button>
        </div>
      </div>
    );
  }

  const isComplete = data.status === 'Final' || data.status === 'Completed Early';
  const isLive = data.status === 'In Progress';
  const isUpcoming = !isComplete && !isLive;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <MLBGameHeader data={data} />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">

        {/* Upcoming game preview */}
        {isUpcoming && (
          <>
            <MLBProbablePitchers
              awayPitcherId={data.awayTeam.probablePitcherId}
              homePitcherId={data.homeTeam.probablePitcherId}
              awayAbbrev={data.awayTeam.abbreviation}
              homeAbbrev={data.homeTeam.abbreviation}
              awayLogo={data.awayTeam.logo}
              homeLogo={data.homeTeam.logo}
            />
            <MLBTeamComparison
              awayTeamId={data.awayTeam.id}
              homeTeamId={data.homeTeam.id}
              awayAbbrev={data.awayTeam.abbreviation}
              homeAbbrev={data.homeTeam.abbreviation}
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <MLBStandingsContext
                awayAbbrev={data.awayTeam.abbreviation}
                homeAbbrev={data.homeTeam.abbreviation}
                awayLogo={data.awayTeam.logo}
                homeLogo={data.homeTeam.logo}
              />
              <MLBRecentForm
                awayTeamId={data.awayTeam.id}
                homeTeamId={data.homeTeam.id}
                awayAbbrev={data.awayTeam.abbreviation}
                homeAbbrev={data.homeTeam.abbreviation}
              />
            </div>
            <MLBSeasonSeries
              awayTeamId={data.awayTeam.id}
              homeTeamId={data.homeTeam.id}
              awayAbbrev={data.awayTeam.abbreviation}
              homeAbbrev={data.homeTeam.abbreviation}
            />
          </>
        )}

        {isComplete && data.scoringPlays.length > 0 && (
          <MLBScoringPlays plays={data.scoringPlays} awayAbbrev={data.awayTeam.abbreviation} homeAbbrev={data.homeTeam.abbreviation} />
        )}

        {(isComplete || data.status === 'In Progress') && (
          <>
            <MLBBattingStats batters={data.batters.away} teamName={data.awayTeam.teamName} teamAbbrev={data.awayTeam.abbreviation} teamLogo={data.awayTeam.logo} />
            <MLBBattingStats batters={data.batters.home} teamName={data.homeTeam.teamName} teamAbbrev={data.homeTeam.abbreviation} teamLogo={data.homeTeam.logo} />
            <MLBPitchingStats pitchers={data.pitchers.away} teamName={data.awayTeam.teamName} teamAbbrev={data.awayTeam.abbreviation} teamLogo={data.awayTeam.logo} />
            <MLBPitchingStats pitchers={data.pitchers.home} teamName={data.homeTeam.teamName} teamAbbrev={data.homeTeam.abbreviation} teamLogo={data.homeTeam.logo} />
          </>
        )}

        <footer className="text-center text-xs text-gray-400 py-8">
          Data provided by MLB Stats API &bull; &copy; {new Date().getFullYear()} JRR Apps
        </footer>
      </main>
    </div>
  );
}
