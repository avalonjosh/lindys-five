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
        /* ── Projected view: full bracket (same as live) + cup odds ── */
        <>
          {/* Desktop: Full bracket layout */}
          <div className="hidden lg:block mb-8">
            <DesktopBracket eastern={eastern} western={western} />
          </div>

          {/* Mobile/Tablet: Visual bracket */}
          <div className="lg:hidden mb-8">
            <MobileBracket eastern={eastern} western={western} />
          </div>

          {/* Cup odds below */}
          <StanleyCupOdds odds={cupOdds} />
        </>
      ) : (
        /* ── Real playoffs: full bracket grid + mobile cards ── */
        <>
          {/* Desktop: Full bracket layout */}
          <div className="hidden lg:block">
            <DesktopBracket eastern={eastern} western={western} />
          </div>

          {/* Mobile/Tablet: Visual bracket */}
          <div className="lg:hidden">
            <MobileBracket eastern={eastern} western={western} />
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

function MobileBracket({ eastern, western }: { eastern: ConferenceBracket; western: ConferenceBracket }) {
  const finalMatchup = [...eastern.rounds, ...western.rounds]
    .find(r => r.roundNumber === 4)?.matchups[0];

  const westR1 = [...getMatchups(western, 1)];
  while (westR1.length < 4) westR1.push(TBD_MATCHUP);
  const westR2 = [...getMatchups(western, 2)];
  while (westR2.length < 2) westR2.push(TBD_MATCHUP);
  const westCF = [...getMatchups(western, 3)];
  while (westCF.length < 1) westCF.push(TBD_MATCHUP);

  const eastR1 = [...getMatchups(eastern, 1)];
  while (eastR1.length < 4) eastR1.push(TBD_MATCHUP);
  const eastR2 = [...getMatchups(eastern, 2)];
  while (eastR2.length < 2) eastR2.push(TBD_MATCHUP);
  const eastCF = [...getMatchups(eastern, 3)];
  while (eastCF.length < 1) eastCF.push(TBD_MATCHUP);

  const westDivA = getDivisionLabel(westR1, 0, 'Western') || 'Central';
  const westDivB = getDivisionLabel(westR1, 2, 'Western') || 'Pacific';
  const eastDivA = getDivisionLabel(eastR1, 0, 'Eastern') || 'Atlantic';
  const eastDivB = getDivisionLabel(eastR1, 2, 'Eastern') || 'Metro';

  return (
    <div className="space-y-2">
      {/* ── Top half: Division A from each conference + R2 ── */}
      <div className="grid gap-x-1" style={{ gridTemplateColumns: '1fr 2.5rem 2.5rem 1fr' }}>
        {/* R1 labels */}
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mb-1">R1</div>
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mb-1 col-span-2">R2</div>
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mb-1">R1</div>

        {/* West R1 div A */}
        <div className="space-y-1.5">
          <BracketCell matchup={westR1[0]} />
          <BracketCell matchup={westR1[1]} />
        </div>
        {/* R2 boxes */}
        <div className="flex items-center px-1">
          <div className="w-14">
            <BracketCell matchup={westR2[0]} />
          </div>
        </div>
        <div className="flex items-center px-1">
          <div className="w-14">
            <BracketCell matchup={eastR2[0]} />
          </div>
        </div>
        {/* East R1 div A */}
        <div className="space-y-1.5">
          <BracketCell matchup={eastR1[0]} />
          <BracketCell matchup={eastR1[1]} />
        </div>
      </div>

      {/* Conference Finals + Cup */}
      <div className="flex items-center justify-center gap-4 py-3">
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-center">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Western</span>
          <div className="text-[9px] text-gray-400">Conference Final</div>
        </div>
        <div className="w-28">
          <BracketCell matchup={finalMatchup || TBD_MATCHUP} cupFinal />
        </div>
        <div className="bg-gray-50 rounded-lg border border-gray-200 shadow-sm px-3 py-2 text-center">
          <span className="text-[10px] font-bold text-gray-500 uppercase">Eastern</span>
          <div className="text-[9px] text-gray-400">Conference Final</div>
        </div>
      </div>

      {/* ── Bottom half: Division B from each conference + R2 ── */}
      <div className="grid gap-x-1" style={{ gridTemplateColumns: '1fr 2.5rem 2.5rem 1fr' }}>
        {/* West R1 div B */}
        <div className="space-y-1.5">
          <BracketCell matchup={westR1[2]} />
          <BracketCell matchup={westR1[3]} />
        </div>
        {/* R2 boxes */}
        <div className="flex items-center px-1">
          <div className="w-14">
            <BracketCell matchup={westR2[1]} />
          </div>
        </div>
        <div className="flex items-center px-1">
          <div className="w-14">
            <BracketCell matchup={eastR2[1]} />
          </div>
        </div>
        {/* East R1 div B */}
        <div className="space-y-1.5">
          <BracketCell matchup={eastR1[2]} />
          <BracketCell matchup={eastR1[3]} />
        </div>

        {/* R2 + R1 labels at bottom */}
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mt-1">R1</div>
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mt-1 col-span-2">R2</div>
        <div className="text-center text-[10px] font-semibold text-gray-400 uppercase mt-1">R1</div>
      </div>
    </div>
  );
}

function getDivisionLabel(matchups: BracketMatchup[], index: number, conference: 'Eastern' | 'Western'): string | undefined {
  // Only label the first matchup of each division pair (index 0 and 2)
  if (index !== 0 && index !== 2) return undefined;
  // Try to detect division from team abbreviation
  const ATLANTIC = ['BOS', 'BUF', 'DET', 'FLA', 'MTL', 'OTT', 'TBL', 'TOR'];
  const CENTRAL = ['CHI', 'COL', 'DAL', 'MIN', 'NSH', 'STL', 'UTA', 'WPG'];
  const m = matchups[index];
  const abbrev = m?.topSeed?.abbrev || m?.bottomSeed?.abbrev;
  if (!abbrev) return index === 0 ? (conference === 'Eastern' ? 'Atlantic' : 'Central') : (conference === 'Eastern' ? 'Metro' : 'Pacific');
  if (conference === 'Eastern') return ATLANTIC.includes(abbrev) ? 'Atlantic' : 'Metro';
  return CENTRAL.includes(abbrev) ? 'Central' : 'Pacific';
}

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

  // 13-column grid: West on left, East on right
  // Col: wR1 | c | wR2 | c | wCF | c | Final | c | eCF | c | eR2 | c | eR1
  //       1    2    3    4    5    6    7      8    9   10   11  12   13
  const colTemplate = '3fr 12px 2fr 12px 1.5fr 12px 2fr 12px 1.5fr 12px 2fr 12px 3fr';

  return (
    <div>
      {/* Round labels */}
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
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Western</span>
        </div>
        <div style={{ gridColumn: '6 / 9' }} />
        <div style={{ gridColumn: '9 / 14' }} className="text-center">
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">Eastern</span>
        </div>
      </div>

      {/* Division labels positioned above R1 columns */}
      <div className="grid mb-0" style={{ gridTemplateColumns: colTemplate }}>
        <div style={{ gridColumn: '1' }}>
          <div className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
            {getDivisionLabel(westR1, 0, 'Western')}
          </div>
        </div>
        <div style={{ gridColumn: '2 / 13' }} />
        <div style={{ gridColumn: '13' }}>
          <div className="text-center text-[9px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">
            {getDivisionLabel(eastR1, 0, 'Eastern')}
          </div>
        </div>
      </div>

      {/* 13 cols × 4 rows bracket */}
      <div className="grid" style={{ gridTemplateColumns: colTemplate, gridTemplateRows: 'repeat(4, 90px)' }}>

        {/* ── West R1 (col 1, rows 1-4) ── */}
        <Cell col={1} row="1" matchup={westR1[0]} />
        <Cell col={1} row="2" matchup={westR1[1]} />
        <Cell col={1} row="3" matchup={westR1[2]} />
        <Cell col={1} row="4" matchup={westR1[3]} />

        {/* ── Connector col 2: R1→R2 (West) ── */}
        <BracketConnector col={2} topRow="1" bottomRow="2" side="left" />
        <BracketConnector col={2} topRow="3" bottomRow="4" side="left" />

        {/* ── West R2 (col 3, spans 2 rows each) ── */}
        <Cell col={3} row="1 / 3" matchup={westR2[0]} />
        <Cell col={3} row="3 / 5" matchup={westR2[1]} />

        {/* ── Connector col 4: R2→CF (West) ── */}
        <BracketMerge col={4} rowSpan="1 / 5" side="left" />

        {/* ── West CF (col 5, spans all 4) ── */}
        <Cell col={5} row="1 / 5" matchup={westR3[0]} />

        {/* ── Connector col 6: CF→Final ── */}
        <div className="flex items-center justify-center" style={{ gridColumn: '6', gridRow: '1 / 5' }}>
          <div className="w-full h-0.5 bg-gray-300" />
        </div>

        {/* ── Stanley Cup Final (col 7) ── */}
        <div className="flex flex-col justify-center px-0.5" style={{ gridColumn: '7', gridRow: '1 / 5' }}>
          <BracketCell matchup={finalMatchup || TBD_MATCHUP} cupFinal />
        </div>

        {/* ── Connector col 8: Final→CF ── */}
        <div className="flex items-center justify-center" style={{ gridColumn: '8', gridRow: '1 / 5' }}>
          <div className="w-full h-0.5 bg-gray-300" />
        </div>

        {/* ── East CF (col 9, spans all 4) ── */}
        <Cell col={9} row="1 / 5" matchup={eastR3[0]} />

        {/* ── Connector col 10: CF→R2 (East) ── */}
        <BracketMerge col={10} rowSpan="1 / 5" side="right" />

        {/* ── East R2 (col 11) ── */}
        <Cell col={11} row="1 / 3" matchup={eastR2[0]} />
        <Cell col={11} row="3 / 5" matchup={eastR2[1]} />

        {/* ── Connector col 12: R2→R1 (East) ── */}
        <BracketConnector col={12} topRow="1" bottomRow="2" side="right" />
        <BracketConnector col={12} topRow="3" bottomRow="4" side="right" />

        {/* ── East R1 (col 13, rows 1-4) ── */}
        <Cell col={13} row="1" matchup={eastR1[0]} />
        <Cell col={13} row="2" matchup={eastR1[1]} />
        <Cell col={13} row="3" matchup={eastR1[2]} />
        <Cell col={13} row="4" matchup={eastR1[3]} />
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

// Bracket connector: merges two adjacent R1 matchups into one R2 slot.
// Uses absolute-positioned lines inside a single spanning container.
function BracketConnector({ col, topRow, bottomRow, side }: { col: number; topRow: string; bottomRow: string; side: 'left' | 'right' }) {
  const rowSpan = `${topRow} / ${parseInt(bottomRow) + 1}`;
  const isLeft = side === 'left';

  return (
    <div className="relative" style={{ gridColumn: col, gridRow: rowSpan }}>
      {/* Top horizontal tick at 25% (center of top row) */}
      <div className="absolute left-0 right-0 bg-gray-300" style={{ top: '25%', height: 2 }} />
      {/* Bottom horizontal tick at 75% (center of bottom row) */}
      <div className="absolute left-0 right-0 bg-gray-300" style={{ top: '75%', height: 2 }} />
      {/* Vertical bar connecting the two ticks */}
      <div
        className="absolute bg-gray-300"
        style={{ top: '25%', bottom: '25%', width: 2, [isLeft ? 'right' : 'left']: 0 }}
      />
    </div>
  );
}

// Bracket merge: merges two R2 slots (each spanning 2 rows) into one CF slot (spanning 4 rows).
function BracketMerge({ col, rowSpan, side }: { col: number; rowSpan: string; side: 'left' | 'right' }) {
  const isLeft = side === 'left';

  return (
    <div className="relative" style={{ gridColumn: col, gridRow: rowSpan }}>
      {/* Top horizontal tick at 25% (center of rows 1-2) */}
      <div className="absolute left-0 right-0 bg-gray-300" style={{ top: '25%', height: 2 }} />
      {/* Bottom horizontal tick at 75% (center of rows 3-4) */}
      <div className="absolute left-0 right-0 bg-gray-300" style={{ top: '75%', height: 2 }} />
      {/* Vertical bar connecting the two ticks */}
      <div
        className="absolute bg-gray-300"
        style={{ top: '25%', bottom: '25%', width: 2, [isLeft ? 'right' : 'left']: 0 }}
      />
    </div>
  );
}
