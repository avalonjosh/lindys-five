'use client';

import { useState, useEffect, useCallback } from 'react';
import type { BracketMatchup, ConferenceBracket, StanleyCupOddsEntry } from '@/lib/types/playoffs';
import SeriesCard from './SeriesCard';
import BracketCell from './BracketCell';
import StanleyCupOdds from './StanleyCupOdds';

interface PlayoffBracketClientProps {
  eastern: ConferenceBracket;
  western: ConferenceBracket;
  cupOdds: StanleyCupOddsEntry[];
  hasLiveGames: boolean;
  isProjected?: boolean;
}

const ROUND_LABELS: Record<number, string> = {
  1: 'First Round',
  2: 'Second Round',
  3: 'Conference Finals',
  4: 'Stanley Cup Final',
};

export default function PlayoffBracketClient({
  eastern: initialEastern,
  western: initialWestern,
  cupOdds: initialCupOdds,
  hasLiveGames: initialHasLive,
  isProjected = false,
}: PlayoffBracketClientProps) {
  const [eastern, setEastern] = useState(initialEastern);
  const [western, setWestern] = useState(initialWestern);
  const [cupOdds, setCupOdds] = useState(initialCupOdds);
  const [hasLive, setHasLive] = useState(initialHasLive);
  const [activeRound, setActiveRound] = useState<number | null>(null);
  const [view, setView] = useState<'bracket' | 'odds'>('bracket');

  // Determine current active round (latest round with games)
  useEffect(() => {
    const allRounds = [...eastern.rounds, ...western.rounds];
    let latestActive = 1;
    for (const round of allRounds) {
      if (round.matchups.some(m => m.topSeed && m.bottomSeed)) {
        latestActive = Math.max(latestActive, round.roundNumber);
      }
    }
    setActiveRound(latestActive);
  }, [eastern, western]);

  // Poll for live updates
  const pollBracket = useCallback(async () => {
    try {
      const res = await fetch('/api/playoffs/bracket');
      if (res.ok) {
        const data = await res.json();
        if (data.eastern) setEastern(data.eastern);
        if (data.western) setWestern(data.western);
        if (data.cupOdds) setCupOdds(data.cupOdds);
        setHasLive(data.hasLiveGames || false);
      }
    } catch {
      // Silent fail on poll
    }
  }, []);

  useEffect(() => {
    if (!hasLive) return;
    const interval = setInterval(pollBracket, 15000);
    return () => clearInterval(interval);
  }, [hasLive, pollBracket]);

  // Get all available rounds
  const rounds = Array.from(
    new Set([
      ...eastern.rounds.map(r => r.roundNumber),
      ...western.rounds.map(r => r.roundNumber),
    ])
  ).sort();

  return (
    <div>
      {/* View toggle — hidden in projected mode since both are shown together */}
      {!isProjected && (
        <div className="flex justify-center gap-1 mb-6">
          <button
            onClick={() => setView('bracket')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              view === 'bracket' ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            style={view === 'bracket' ? { background: '#003087' } : undefined}
          >
            Bracket
          </button>
          <button
            onClick={() => setView('odds')}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              view === 'odds' ? 'text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
            }`}
            style={view === 'odds' ? { background: '#003087' } : undefined}
          >
            Cup Odds
          </button>
        </div>
      )}

      {view === 'odds' ? (
        <StanleyCupOdds odds={cupOdds} />
      ) : isProjected ? (
        /* ── Projected view: two conference columns + cup odds below ── */
        <>
          {/* Desktop: side-by-side conferences */}
          <div className="hidden md:grid grid-cols-2 gap-8 mb-8">
            <ProjectedConference
              conferenceName="Eastern"
              matchups={getMatchups(eastern, 1)}
            />
            <ProjectedConference
              conferenceName="Western"
              matchups={getMatchups(western, 1)}
            />
          </div>

          {/* Mobile: stacked */}
          <div className="md:hidden space-y-6 mb-8">
            <ProjectedConference
              conferenceName="Eastern"
              matchups={getMatchups(eastern, 1)}
            />
            <ProjectedConference
              conferenceName="Western"
              matchups={getMatchups(western, 1)}
            />
          </div>

          {/* Cup odds below */}
          <StanleyCupOdds odds={cupOdds} />
        </>
      ) : (
        /* ── Real playoffs: full bracket grid + mobile cards ── */
        <>
          {/* Round selector (mobile/tablet) */}
          <div className="flex justify-center gap-1 mb-6 lg:hidden">
            {rounds.map(r => (
              <button
                key={r}
                onClick={() => setActiveRound(r)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeRound === r ? 'text-white' : 'bg-gray-200 text-gray-600'
                }`}
                style={activeRound === r ? { background: '#003087' } : undefined}
              >
                {r === 4 ? 'Final' : `R${r}`}
              </button>
            ))}
          </div>

          {/* Desktop: Full bracket layout */}
          <div className="hidden lg:block">
            <DesktopBracket eastern={eastern} western={western} />
          </div>

          {/* Mobile/Tablet: Series cards by round */}
          <div className="lg:hidden space-y-6">
            {rounds
              .filter(r => activeRound === null || r === activeRound)
              .map(roundNum => {
                const eastMatchups = eastern.rounds.find(r => r.roundNumber === roundNum)?.matchups || [];
                const westMatchups = western.rounds.find(r => r.roundNumber === roundNum)?.matchups || [];

                return (
                  <div key={roundNum}>
                    <h3
                      className="text-lg font-bold text-gray-900 mb-3"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      {ROUND_LABELS[roundNum] || `Round ${roundNum}`}
                    </h3>

                    {roundNum < 4 ? (
                      <div className="space-y-6">
                        {eastMatchups.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              Eastern Conference
                            </p>
                            <div className="space-y-3">
                              {eastMatchups.map(m => (
                                <SeriesCard key={m.seriesLetter} matchup={m} />
                              ))}
                            </div>
                          </div>
                        )}
                        {westMatchups.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                              Western Conference
                            </p>
                            <div className="space-y-3">
                              {westMatchups.map(m => (
                                <SeriesCard key={m.seriesLetter} matchup={m} />
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {[...eastMatchups, ...westMatchups].map(m => (
                          <SeriesCard key={m.seriesLetter} matchup={m} />
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>

          {/* Live indicator */}
          {hasLive && (
            <div className="mt-6 text-center text-sm text-gray-500">
              <span className="inline-flex items-center gap-2">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                Live games update every 15 seconds
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function getMatchups(conf: ConferenceBracket, round: number): BracketMatchup[] {
  return conf.rounds.find(r => r.roundNumber === round)?.matchups || [];
}

// Placeholder for TBD matchup slots
const TBD_MATCHUP: BracketMatchup = {
  seriesLetter: 'TBD',
  topSeed: null,
  bottomSeed: null,
  topSeedWins: 0,
  bottomSeedWins: 0,
  isComplete: false,
  winningSeed: null,
  topSeedSeriesWinPct: 50,
  bottomSeedSeriesWinPct: 50,
  games: [],
};

function DesktopBracket({ eastern, western }: { eastern: ConferenceBracket; western: ConferenceBracket }) {
  const finalMatchup = [...eastern.rounds, ...western.rounds]
    .find(r => r.roundNumber === 4)?.matchups[0];

  // Pad matchup arrays to expected lengths
  const eastR1 = [...getMatchups(eastern, 1)];
  while (eastR1.length < 4) eastR1.push(TBD_MATCHUP);
  const eastR2 = [...getMatchups(eastern, 2)];
  while (eastR2.length < 2) eastR2.push(TBD_MATCHUP);
  const eastR3 = [...getMatchups(eastern, 3)];
  while (eastR3.length < 1) eastR3.push(TBD_MATCHUP);

  const westR1 = [...getMatchups(western, 1)];
  while (westR1.length < 4) westR1.push(TBD_MATCHUP);
  const westR2 = [...getMatchups(western, 2)];
  while (westR2.length < 2) westR2.push(TBD_MATCHUP);
  const westR3 = [...getMatchups(western, 3)];
  while (westR3.length < 1) westR3.push(TBD_MATCHUP);

  // 13-column grid: matchup columns + connector columns between rounds
  // Col: eR1 | c | eR2 | c | eCF | c | Final | c | wCF | c | wR2 | c | wR1
  //       1    2    3    4    5    6    7      8    9   10   11  12   13
  const colTemplate = '2fr 12px 2fr 12px 2fr 12px 2fr 12px 2fr 12px 2fr 12px 2fr';

  return (
    <div>
      {/* Round labels — span the matchup columns, skip connector columns */}
      <div className="grid mb-2" style={{ gridTemplateColumns: colTemplate }}>
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '1' }}>R1</div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '3' }}>R2</div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '5' }}>Conf. Finals</div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-700 uppercase tracking-wider" style={{ gridColumn: '7' }}>
          Stanley Cup
        </div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '9' }}>Conf. Finals</div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '11' }}>R2</div>
        <div />
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider" style={{ gridColumn: '13' }}>R1</div>
      </div>

      {/* Conference labels */}
      <div className="grid mb-3" style={{ gridTemplateColumns: colTemplate }}>
        <div style={{ gridColumn: '1 / 6' }} className="text-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Eastern</span>
        </div>
        <div style={{ gridColumn: '6 / 9' }} />
        <div style={{ gridColumn: '9 / 14' }} className="text-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Western</span>
        </div>
      </div>

      {/* 13 cols × 4 rows bracket */}
      <div className="grid" style={{ gridTemplateColumns: colTemplate, gridTemplateRows: 'repeat(4, minmax(100px, 1fr))' }}>

        {/* ── East R1 (col 1, rows 1-4) ── */}
        <Cell col={1} row="1" matchup={eastR1[0]} />
        <Cell col={1} row="2" matchup={eastR1[1]} />
        <Cell col={1} row="3" matchup={eastR1[2]} />
        <Cell col={1} row="4" matchup={eastR1[3]} />

        {/* ── Connector col 2: R1→R2 (East) ── */}
        <BracketLine col={2} rowSpan="1 / 3" /> {/* joins R1 slots 1-2 */}
        <BracketLine col={2} rowSpan="3 / 5" /> {/* joins R1 slots 3-4 */}

        {/* ── East R2 (col 3, spans 2 rows each) ── */}
        <Cell col={3} row="1 / 3" matchup={eastR2[0]} />
        <Cell col={3} row="3 / 5" matchup={eastR2[1]} />

        {/* ── Connector col 4: R2→CF (East) ── */}
        <BracketLine col={4} rowSpan="1 / 5" /> {/* joins R2 slots 1-2 */}

        {/* ── East CF (col 5, spans all 4) ── */}
        <Cell col={5} row="1 / 5" matchup={eastR3[0]} />

        {/* ── Connector col 6: CF→Final ── */}
        <div className="flex items-center justify-center" style={{ gridColumn: '6', gridRow: '1 / 5' }}>
          <div className="w-full h-0.5 bg-gray-300" />
        </div>

        {/* ── Stanley Cup Final (col 7) ── */}
        <div className="flex flex-col justify-center px-0.5" style={{ gridColumn: '7', gridRow: '1 / 5' }}>
          <div className="text-center mb-1">
            <span className="text-lg">🏆</span>
          </div>
          <BracketCell matchup={finalMatchup || TBD_MATCHUP} />
        </div>

        {/* ── Connector col 8: Final→CF ── */}
        <div className="flex items-center justify-center" style={{ gridColumn: '8', gridRow: '1 / 5' }}>
          <div className="w-full h-0.5 bg-gray-300" />
        </div>

        {/* ── West CF (col 9, spans all 4) ── */}
        <Cell col={9} row="1 / 5" matchup={westR3[0]} />

        {/* ── Connector col 10: CF→R2 (West) ── */}
        <BracketLine col={10} rowSpan="1 / 5" />

        {/* ── West R2 (col 11) ── */}
        <Cell col={11} row="1 / 3" matchup={westR2[0]} />
        <Cell col={11} row="3 / 5" matchup={westR2[1]} />

        {/* ── Connector col 12: R2→R1 (West) ── */}
        <BracketLine col={12} rowSpan="1 / 3" />
        <BracketLine col={12} rowSpan="3 / 5" />

        {/* ── West R1 (col 13, rows 1-4) ── */}
        <Cell col={13} row="1" matchup={westR1[0]} />
        <Cell col={13} row="2" matchup={westR1[1]} />
        <Cell col={13} row="3" matchup={westR1[2]} />
        <Cell col={13} row="4" matchup={westR1[3]} />
      </div>
    </div>
  );
}

// Cell wrapper — places a BracketCell in the grid
function Cell({ col, row, matchup }: { col: number; row: string; matchup: BracketMatchup }) {
  return (
    <div className="flex flex-col justify-center px-0.5 py-1" style={{ gridColumn: col, gridRow: row }}>
      <BracketCell matchup={matchup} />
    </div>
  );
}

// Projected view: conference header + stacked SeriesCards (first round only)
function ProjectedConference({ conferenceName, matchups }: { conferenceName: string; matchups: BracketMatchup[] }) {
  return (
    <div>
      <h3
        className="text-lg font-bold text-gray-900 mb-3"
        style={{ fontFamily: 'Bebas Neue, sans-serif' }}
      >
        {conferenceName} Conference
      </h3>
      <div className="space-y-3">
        {matchups.map(m => (
          <SeriesCard key={m.seriesLetter} matchup={m} />
        ))}
      </div>
    </div>
  );
}

// Bracket connector line in a narrow column between two rounds.
// Draws: top tick, bottom tick, vertical joining them, center output line.
function BracketLine({ col, rowSpan }: { col: number; rowSpan: string }) {
  return (
    <div className="relative" style={{ gridColumn: col, gridRow: rowSpan }}>
      {/* Vertical line joining top and bottom */}
      <div className="absolute left-0 top-1/4 bottom-1/4 w-0.5 bg-gray-300" />
      {/* Top horizontal tick */}
      <div className="absolute top-1/4 left-0 w-full h-0.5 bg-gray-300" />
      {/* Bottom horizontal tick */}
      <div className="absolute bottom-1/4 left-0 w-full h-0.5 bg-gray-300" />
      {/* Center output line */}
      <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-300" />
    </div>
  );
}
