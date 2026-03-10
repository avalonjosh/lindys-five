'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchBoxScoreData, fetchStandingsForDate, fetchRightRail } from '@/lib/services/boxscoreApi';
import type {
  BoxscoreResponse,
  LandingResponse,
  StandingsTeam,
  BoxScoreData,
  RightRailResponse,
} from '@/lib/types/boxscore';
import GameHeader from './GameHeader';
import ScoringTimeline from './ScoringTimeline';
import PlayoffImpact from './PlayoffImpact';
import ThreeStars from './ThreeStars';
import ScoringPlays from './ScoringPlays';
import TeamComparison from './TeamComparison';
import PlayerStatsTable from './PlayerStatsTable';
import GoalieStatsTable from './GoalieStatsTable';
import PenaltySummary from './PenaltySummary';
import StandingsSnapshot from './StandingsSnapshot';
import SkaterMatchup from './SkaterMatchup';
import GoalieMatchup from './GoalieMatchup';
import SeasonSeries from './SeasonSeries';
import TeamStatsPreview from './TeamStatsPreview';

interface BoxScoreClientProps {
  gameId: string;
}

export default function BoxScoreClient({ gameId }: BoxScoreClientProps) {
  const [boxscore, setBoxscore] = useState<BoxscoreResponse | null>(null);
  const [landing, setLanding] = useState<LandingResponse | null>(null);
  const [standings, setStandings] = useState<StandingsTeam[]>([]);
  const [rightRail, setRightRail] = useState<RightRailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data: BoxScoreData = await fetchBoxScoreData(gameId);
      setBoxscore(data.boxscore);
      setLanding(data.landing);
      setError(null);
      return data;
    } catch (err) {
      console.error('Failed to fetch box score data:', err);
      setError('Failed to load box score. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  // Initial data load
  useEffect(() => {
    setLoading(true);
    fetchData().then((data) => {
      if (data) {
        // Fetch standings and right-rail non-blocking after initial load
        const gameDate = data.boxscore.gameDate;
        fetchStandingsForDate(gameDate).then((standingsData) => {
          setStandings(standingsData);
        });
        fetchRightRail(gameId).then((rightRailData) => {
          setRightRail(rightRailData);
        });
      }
    });
  }, [fetchData, gameId]);

  // Poll every 15s for LIVE games (re-fetch boxscore + landing only, not standings)
  useEffect(() => {
    if (!boxscore) return;

    const isLive = boxscore.gameState === 'LIVE' || boxscore.gameState === 'CRIT';

    if (!isLive) {
      // Clear any existing poll if game is no longer live
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const data: BoxScoreData = await fetchBoxScoreData(gameId);
        setBoxscore(data.boxscore);
        setLanding(data.landing);

        // Stop polling if game became FINAL
        const newState = data.boxscore.gameState;
        if (newState === 'FINAL' || newState === 'OFF') {
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
          // Refresh standings now that game is final
          const gameDate = data.boxscore.gameDate;
          fetchStandingsForDate(gameDate).then((standingsData) => {
            setStandings(standingsData);
          });
        }
      } catch (err) {
        console.error('Failed to poll box score:', err);
      }
    }, 15000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [boxscore?.gameState, gameId]);

  const handleRetry = () => {
    setLoading(true);
    setError(null);
    fetchData().then((data) => {
      if (data) {
        const gameDate = data.boxscore.gameDate;
        fetchStandingsForDate(gameDate).then((standingsData) => {
          setStandings(standingsData);
        });
        fetchRightRail(gameId).then((rightRailData) => {
          setRightRail(rightRailData);
        });
      }
    });
  };

  const isFinal =
    boxscore?.gameState === 'FINAL' || boxscore?.gameState === 'OFF';
  const isFuture =
    boxscore?.gameState === 'FUT' || boxscore?.gameState === 'PRE';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Loading State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-t-transparent border-blue-500" />
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-12 rounded-xl bg-red-50 text-red-600 max-w-6xl mx-auto mt-6">
          <p className="text-lg font-semibold mb-4">{error}</p>
          <button
            onClick={handleRetry}
            className="px-4 py-2 rounded-lg font-semibold transition-colors bg-blue-500 text-white hover:bg-blue-600"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Main Content */}
      {!loading && !error && boxscore && landing && (
        <>
          <GameHeader boxscore={boxscore} landing={landing} />

          <main className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
            {/* Future game: preview with ticket CTA */}
            {isFuture && (
              <>
                {/* Pre-game matchup sections */}
                {landing.matchup?.skaterComparison && (
                  <SkaterMatchup
                    skaterComparison={landing.matchup.skaterComparison}
                    homeAbbrev={boxscore.homeTeam.abbrev}
                    awayAbbrev={boxscore.awayTeam.abbrev}
                  />
                )}

                {landing.matchup?.goalieComparison && (
                  <GoalieMatchup
                    goalieComparison={landing.matchup.goalieComparison}
                    homeAbbrev={boxscore.homeTeam.abbrev}
                    awayAbbrev={boxscore.awayTeam.abbrev}
                  />
                )}

                {rightRail?.teamSeasonStats && rightRail?.last10Record && (
                  <TeamStatsPreview
                    teamSeasonStats={rightRail.teamSeasonStats}
                    last10Record={rightRail.last10Record}
                    homeAbbrev={boxscore.homeTeam.abbrev}
                    awayAbbrev={boxscore.awayTeam.abbrev}
                  />
                )}

                {rightRail?.seasonSeries && rightRail.seasonSeries.length > 0 && (
                  <SeasonSeries
                    games={rightRail.seasonSeries}
                    seriesWins={rightRail.seasonSeriesWins}
                    homeAbbrev={boxscore.homeTeam.abbrev}
                    awayAbbrev={boxscore.awayTeam.abbrev}
                    currentGameId={gameId}
                  />
                )}
              </>
            )}

            {/* Scoring timeline - only for started/finished games */}
            {!isFuture && (
              <ScoringTimeline
                scoring={landing.summary?.scoring || []}
                homeTeamAbbrev={boxscore.homeTeam.abbrev}
                awayTeamAbbrev={boxscore.awayTeam.abbrev}
              />
            )}

            <PlayoffImpact
              homeTeam={boxscore.homeTeam}
              awayTeam={boxscore.awayTeam}
              standings={standings}
              gameState={boxscore.gameState}
              gameOutcome={boxscore.gameOutcome}
            />

            {standings.length > 0 && (
              <StandingsSnapshot
                standings={standings}
                homeAbbrev={boxscore.homeTeam.abbrev}
                awayAbbrev={boxscore.awayTeam.abbrev}
                gameDate={boxscore.gameDate}
                currentGameId={gameId}
              />
            )}

            {/* Season series for started/finished games */}
            {!isFuture && rightRail?.seasonSeries && rightRail.seasonSeries.length > 0 && (
              <SeasonSeries
                games={rightRail.seasonSeries}
                seriesWins={rightRail.seasonSeriesWins}
                homeAbbrev={boxscore.homeTeam.abbrev}
                awayAbbrev={boxscore.awayTeam.abbrev}
                currentGameId={gameId}
              />
            )}

            {/* Sections below only render for started/finished games */}
            {!isFuture && (
              <>
                {isFinal && landing.summary?.threeStars && (
                  <ThreeStars
                    threeStars={landing.summary.threeStars}
                    homeTeamAbbrev={boxscore.homeTeam.abbrev}
                    awayTeamAbbrev={boxscore.awayTeam.abbrev}
                  />
                )}

                <ScoringPlays
                  scoring={landing.summary?.scoring || []}
                  homeTeamAbbrev={boxscore.homeTeam.abbrev}
                  awayTeamAbbrev={boxscore.awayTeam.abbrev}
                />

                <TeamComparison
                  teamGameStats={landing.summary?.teamGameStats}
                  homeTeamAbbrev={boxscore.homeTeam.abbrev}
                  awayTeamAbbrev={boxscore.awayTeam.abbrev}
                />

                {/* Away Team Player Stats */}
                <PlayerStatsTable
                  forwards={boxscore.playerByGameStats.awayTeam.forwards}
                  defense={boxscore.playerByGameStats.awayTeam.defense}
                  teamAbbrev={boxscore.awayTeam.abbrev}
                  teamName={boxscore.awayTeam.commonName.default}
                  teamLogo={boxscore.awayTeam.logo}
                />

                {/* Home Team Player Stats */}
                <PlayerStatsTable
                  forwards={boxscore.playerByGameStats.homeTeam.forwards}
                  defense={boxscore.playerByGameStats.homeTeam.defense}
                  teamAbbrev={boxscore.homeTeam.abbrev}
                  teamName={boxscore.homeTeam.commonName.default}
                  teamLogo={boxscore.homeTeam.logo}
                />

                <GoalieStatsTable
                  homeGoalies={boxscore.playerByGameStats.homeTeam.goalies}
                  awayGoalies={boxscore.playerByGameStats.awayTeam.goalies}
                  homeAbbrev={boxscore.homeTeam.abbrev}
                  awayAbbrev={boxscore.awayTeam.abbrev}
                  homeLogo={boxscore.homeTeam.logo}
                  awayLogo={boxscore.awayTeam.logo}
                />

                <PenaltySummary
                  penalties={landing.summary?.penalties || []}
                  homeAbbrev={boxscore.homeTeam.abbrev}
                  awayAbbrev={boxscore.awayTeam.abbrev}
                />
              </>
            )}
          </main>
        </>
      )}

      <footer className="mt-auto py-6 text-center text-sm text-gray-500">
        <p>Lindy&apos;s Five &bull; {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}
