'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { TEAMS } from '@/lib/teamConfig';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';
import { trackClick } from '@/lib/analytics';
import { computeSeriesWinProbability } from '@/lib/utils/playoffProbability';
import { generateAmazonMerchLink } from '@/lib/utils/affiliateLinks';
import { hasTeamHistory } from '@/lib/data/teamHistory';
import { ShoppingBag } from 'lucide-react';

export interface JourneyGame {
  gameId: number;
  gameNumber: number;
  gameState: string;
  gameScheduleState?: string;
  startTimeUTC?: string;
  ifNecessary?: boolean;
  homeTeam: { abbrev: string; score?: number };
  awayTeam: { abbrev: string; score?: number };
  gameOutcome?: { lastPeriodType: string };
  period?: number;
  periodDescriptor?: { periodType?: string };
  clock?: { timeRemaining?: string; inIntermission?: boolean };
}

export interface JourneySeries {
  roundNumber: number;
  roundLabel: string;
  seriesLetter: string;
  teamAbbrev: string;
  opponent: { abbrev: string; name: string; logo: string };
  teamWins: number;
  opponentWins: number;
  neededToWin: number;
  games: JourneyGame[];
  isComplete: boolean;
  didAdvance: boolean;
  teamPointPctg?: number;
  opponentPointPctg?: number;
  teamHasHomeIce?: boolean;
  regularSeasonH2H?: { wins: number; losses: number; otLosses: number; gamesPlayed: number };
  teamGoalDiffPerGame?: number;
  opponentGoalDiffPerGame?: number;
  teamHomeWinPct?: number;
  teamRoadWinPct?: number;
  opponentHomeWinPct?: number;
  opponentRoadWinPct?: number;
}

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

interface PlayoffJourneyProps {
  series: JourneySeries[];
  teamAbbrev: string;
  teamName: string;
  teamLogo: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
  cupOdds?: number | null;
  cupOddsRank?: { rank: number; total: number } | null;
}

const ROUND_ABBREV: Record<number, string> = { 1: 'R1', 2: 'R2', 3: 'CF', 4: 'SCF' };
const NEXT_ROUND_LABEL: Record<number, string> = {
  2: 'Round 2',
  3: 'Conference Final',
  4: 'Stanley Cup Final',
  5: 'Stanley Cup Champions',
};

function gameOutcomeForTeam(game: JourneyGame, teamAbbrev: string): 'W' | 'L' | null {
  const isFinal = game.gameState === 'FINAL' || game.gameState === 'OFF';
  if (!isFinal || game.homeTeam.score == null || game.awayTeam.score == null) return null;
  const teamScore = game.homeTeam.abbrev === teamAbbrev ? game.homeTeam.score : game.awayTeam.score;
  const oppScore = game.homeTeam.abbrev === teamAbbrev ? game.awayTeam.score : game.homeTeam.score;
  return teamScore > oppScore ? 'W' : 'L';
}

function formatGameDateTime(utc: string | undefined, tbd: boolean): { date: string; time: string } {
  if (!utc) return { date: 'TBD', time: '' };
  const d = new Date(utc);
  const date = d.toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' });
  const time = tbd ? 'TBD' : d.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) + ' ET';
  return { date, time };
}

// --- Cup wins card (Road to the Cup — mirrors the Regular Season Progress card) ---
const CUP_GROUP_LABELS = ['R1', 'R2', 'CF', 'SCF'];
const ROUND_DISPLAY_NAME: Record<number, string> = {
  1: '1st Round',
  2: '2nd Round',
  3: 'Conference Final',
  4: 'Stanley Cup Final',
};

function CupWinsCard({ roundWins, activeSeries, teamColors, darkModeColors, isGoatMode, cupOdds, cupOddsRank }: {
  roundWins: number[]; // length 4: wins in R1, R2, CF, SCF
  activeSeries: JourneySeries;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
  cupOdds?: number | null;
  cupOddsRank?: { rank: number; total: number } | null;
}) {
  const accent = isGoatMode ? darkModeColors.accent : teamColors.primary;
  const cardBg = isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : '#ffffff';
  const borderColor = isGoatMode ? darkModeColors.border : '#e5e7eb';
  const emptyBorder = isGoatMode ? darkModeColors.border : '#e5e7eb';
  const strongText = isGoatMode ? darkModeColors.text : '#111827';
  const mutedText = isGoatMode ? `${darkModeColors.text}66` : '#6b7280';
  const subText = isGoatMode ? `${darkModeColors.text}99` : '#6b7280';
  const labelColor = isGoatMode ? `${darkModeColors.text}cc` : '#475569';
  const activeLabelColor = isGoatMode ? darkModeColors.accent : teamColors.primary;

  const total = roundWins.reduce((sum, w) => sum + Math.min(w, 4), 0);
  const champion = total >= 16;
  const percent = (total / 16) * 100;

  const activeRound = activeSeries.roundNumber;
  const advanced = activeSeries.didAdvance;
  const eliminated = activeSeries.isComplete && !advanced;
  const winsToClinch = Math.max(0, activeSeries.neededToWin - activeSeries.teamWins);
  const currentRoundLabel = ROUND_DISPLAY_NAME[activeRound] || `Round ${activeRound}`;

  // Optional Playoff History link (desktop only — mobile shows it in the team header)
  const teamSlugForHistory = Object.entries(TEAMS).find(([, t]) => t.abbreviation === activeSeries.teamAbbrev)?.[0];
  const showHistoryLink = !!teamSlugForHistory && hasTeamHistory(teamSlugForHistory);

  // Stat box styling (mirrors ProgressBar's stat cards)
  const statBoxClass = 'rounded-xl p-2 md:p-3 border';
  const statBoxStyle: React.CSSProperties = isGoatMode
    ? {
        background: `linear-gradient(to bottom right, ${darkModeColors.cardBackground || darkModeColors.background}f0, ${darkModeColors.cardBackground || darkModeColors.background}e0)`,
        borderColor: darkModeColors.border,
      }
    : { background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)', borderColor: '#bfdbfe' };

  // Caption: rank among Cup contenders (falls back to milestone copy when rank unavailable)
  const ordinal = (n: number): string => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };
  let milestoneText: string;
  let isRankMilestone = false;
  if (champion) {
    milestoneText = 'Stanley Cup Champions';
  } else if (eliminated) {
    milestoneText = `Eliminated in the ${currentRoundLabel}`;
  } else if (cupOddsRank) {
    const { rank } = cupOddsRank;
    isRankMilestone = true;
    if (rank === 1) {
      milestoneText = 'Best Cup odds';
    } else {
      milestoneText = `${ordinal(rank)}-best Cup odds`;
    }
  } else if (advanced) {
    const next = ROUND_DISPLAY_NAME[activeRound + 1] || 'next round';
    milestoneText = `Won the ${currentRoundLabel} — on to the ${next}`;
  } else if (winsToClinch === 1) {
    milestoneText = `1 win away from clinching the ${currentRoundLabel}`;
  } else {
    milestoneText = `Need ${winsToClinch} more wins to clinch the ${currentRoundLabel}`;
  }

  return (
    <div
      className="rounded-2xl shadow-lg p-4 sm:p-5"
      style={{ backgroundColor: cardBg, borderColor, borderStyle: 'solid', borderWidth: 2 }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 md:mb-4">
        <h3 className="text-xl md:text-2xl font-bold" style={{ color: strongText }}>
          Road to the Cup
        </h3>
        {showHistoryLink && (
          <Link
            href={`/nhl/${teamSlugForHistory}/history`}
            className={`text-xs md:text-sm font-semibold transition-colors focus:outline-none ${
              isGoatMode
                ? 'text-zinc-500 hover:text-zinc-400'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="View full playoff history"
          >
            Playoff History
          </Link>
        )}
      </div>

      {/* Hero stat boxes — mobile: 2 boxes (Playoff Wins, Cup Odds). Desktop: 3 boxes (adds Current Round). */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 md:gap-3 mb-2 md:mb-4">
        <div className={`${statBoxClass} hidden sm:block`} style={statBoxStyle}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: labelColor }}>Current Round</div>
          <div className="text-xl md:text-2xl font-bold leading-tight" style={{ color: strongText }}>{currentRoundLabel}</div>
          <div className="text-xs mt-1" style={{ color: subText }}>best of 7</div>
        </div>
        <div className={statBoxClass} style={statBoxStyle}>
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: labelColor }}>Playoff Wins</div>
          <div className="text-2xl md:text-3xl font-bold" style={{ color: strongText }}>{total}</div>
          <div className="text-xs mt-1" style={{ color: subText }}>of 16 needed</div>
        </div>
        <Link
          href="/playoffs"
          className={`${statBoxClass} block transition-shadow hover:shadow-md focus:outline-none`}
          style={statBoxStyle}
          title="View Stanley Cup odds for all remaining teams"
        >
          <div className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: labelColor }}>Cup Odds</div>
          <div className="text-2xl md:text-3xl font-bold" style={{ color: strongText }}>
            {cupOdds == null ? '—' : eliminated ? '0%' : `${cupOdds < 1 && cupOdds > 0 ? '<1' : Math.round(cupOdds)}%`}
          </div>
          <div className="text-xs mt-1" style={{ color: subText }}>chance to win it all</div>
        </Link>
      </div>

      {/* Round labels above the segmented bar — body font (matches stat-box labels) */}
      <div className="flex justify-between mb-1 px-0.5">
        {[0, 1, 2, 3].map((roundIdx) => {
          const isActive = roundIdx + 1 === activeRound;
          return (
            <div key={roundIdx} className="flex-1 text-center">
              <span
                className="text-xs font-bold uppercase tracking-wider"
                style={{ color: isActive ? activeLabelColor : mutedText }}
              >
                {CUP_GROUP_LABELS[roundIdx]}
              </span>
            </div>
          );
        })}
      </div>

      {/* Segmented bar — 4 round groups × 4 segments = 16 wins to the Cup */}
      <div className="flex gap-1.5 sm:gap-2">
        {[0, 1, 2, 3].map((roundIdx) => {
          const wins = Math.min(roundWins[roundIdx] || 0, 4);
          const isActive = roundIdx + 1 === activeRound;
          // Active group uses accent-tinted borders so the 4 game cells stay legible
          // against the tinted background, while keeping spacing consistent across rounds.
          const segmentBorder = isActive ? `${accent}55` : emptyBorder;
          return (
            <div
              key={roundIdx}
              className="flex-1 flex gap-0.5 p-0.5 rounded-md"
              style={{
                backgroundColor: isActive ? `${accent}14` : 'transparent',
                outline: isActive ? `1px solid ${accent}40` : 'none',
              }}
            >
              {[0, 1, 2, 3].map((segIdx) => {
                const filled = segIdx < wins;
                const isFirst = segIdx === 0;
                const isLast = segIdx === 3;
                return (
                  <div
                    key={segIdx}
                    className={`flex-1 h-6 sm:h-7 ${isFirst ? 'rounded-l-sm' : ''} ${isLast ? 'rounded-r-sm' : ''}`}
                    style={{
                      backgroundColor: filled ? accent : 'transparent',
                      border: filled ? 'none' : `1.5px solid ${segmentBorder}`,
                    }}
                  />
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Caption: percent + next milestone — rank line is desktop-only (hidden on mobile to reduce clutter) */}
      <div className="mt-3 flex items-baseline justify-center sm:justify-between gap-2 text-xs md:text-sm" style={{ color: subText }}>
        <span>
          <span className="font-bold" style={{ color: champion ? '#d4af37' : strongText }}>{percent.toFixed(0)}%</span> complete
        </span>
        <span
          className={`font-semibold text-right ${isRankMilestone ? 'hidden sm:inline-block' : ''}`}
          style={{ color: champion ? '#d4af37' : eliminated ? mutedText : activeLabelColor }}
        >
          {milestoneText}
        </span>
      </div>

    </div>
  );
}

// --- Series card (redesigned to match ChunkCard's language) ---
function SeriesCard({
  s,
  teamName,
  teamLogo,
  teamColors,
  darkModeColors,
  isGoatMode,
}: {
  s: JourneySeries;
  teamName: string;
  teamLogo: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
}) {
  const advanced = s.didAdvance;
  const eliminated = s.isComplete && !advanced;

  // Border state — like ChunkCard: solid team color for success, dashed for failure
  let borderStyle: React.CSSProperties;
  if (advanced) {
    borderStyle = { borderColor: isGoatMode ? darkModeColors.accent : teamColors.primary, borderStyle: 'solid', borderWidth: 2 };
  } else if (eliminated) {
    borderStyle = { borderColor: isGoatMode ? darkModeColors.border : '#d1d5db', borderStyle: 'dashed', borderWidth: 2 };
  } else {
    borderStyle = { borderColor: isGoatMode ? darkModeColors.border : '#e5e7eb', borderStyle: 'solid', borderWidth: 2 };
  }

  const cardBg = isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : '#ffffff';
  const accent = isGoatMode ? darkModeColors.accent : teamColors.primary;
  const strongText = isGoatMode ? darkModeColors.text : '#111827';
  const subText = isGoatMode ? `${darkModeColors.text}99` : '#6b7280';
  const mutedText = isGoatMode ? `${darkModeColors.text}66` : '#9ca3af';
  const rowHover = isGoatMode ? 'hover:bg-white/5' : 'hover:bg-gray-50';
  const statBoxBg = isGoatMode
    ? `linear-gradient(to bottom right, ${darkModeColors.cardBackground || darkModeColors.background}, ${darkModeColors.background})`
    : undefined;
  const statBoxBorder = isGoatMode ? darkModeColors.border : '#dbeafe';

  // Status pill copy & color
  let pillText = '';
  let pillStyle: React.CSSProperties = {};
  if (advanced) {
    const next = NEXT_ROUND_LABEL[s.roundNumber + 1] || 'Next round';
    pillText = `Won ${s.teamWins}-${s.opponentWins} → ${next}`;
    pillStyle = { backgroundColor: `${accent}20`, color: accent, borderColor: `${accent}50` };
  } else if (eliminated) {
    pillText = `Eliminated ${s.teamWins}-${s.opponentWins}`;
    pillStyle = { backgroundColor: isGoatMode ? `${darkModeColors.border}40` : '#f3f4f6', color: subText, borderColor: isGoatMode ? darkModeColors.border : '#d1d5db' };
  }
  const showPill = pillText.length > 0;

  const remainingToClinch = Math.max(0, s.neededToWin - s.teamWins);

  // Round title in display-type form (e.g., "1ST ROUND", "CONFERENCE FINAL", "STANLEY CUP FINAL")
  const titleText = s.roundLabel.replace(/-/g, ' ').toUpperCase();

  return (
    <div
      className="relative overflow-hidden rounded-2xl shadow-lg hover:shadow-xl transition-shadow p-4 sm:p-5"
      style={{ ...borderStyle, backgroundColor: cardBg }}
    >
      {/* Desktop (sm+): round badge anchored to the top-left corner of the card */}
      <Link href="/playoffs" className="hidden sm:inline-block absolute top-5 left-5 z-10 px-4 py-1.5 rounded-full text-base tracking-[0.15em] shadow-sm hover:opacity-80 transition-opacity"
        style={{
          backgroundColor: accent,
          color: isGoatMode && darkModeColors.accent.toUpperCase() === '#FFFFFF' ? '#000000' : '#ffffff',
          fontFamily: 'Bebas Neue, sans-serif',
        }}
      >
        {titleText}
      </Link>

      {/* Mobile: round badge centered above the matchup row (normal flow) */}
      <div className="sm:hidden relative flex justify-center mb-3">
        <Link href="/playoffs"
          className="inline-block px-4 py-1.5 rounded-full text-lg tracking-[0.15em] shadow-sm hover:opacity-80 transition-opacity"
          style={{
            backgroundColor: accent,
            color: isGoatMode && darkModeColors.accent.toUpperCase() === '#FFFFFF' ? '#000000' : '#ffffff',
            fontFamily: 'Bebas Neue, sans-serif',
          }}
        >
          {titleText}
        </Link>
      </div>

      {/* Matchup row — logos flank the score, team names omitted (logos carry identity). Logos link to team trackers. */}
      <div className="relative flex items-center justify-center gap-4 sm:gap-6 mb-4">
        {teamLogo && (() => {
          const teamSlug = Object.entries(TEAMS).find(([, t]) => t.abbreviation === s.teamAbbrev)?.[0];
          const logoEl = (
            <Image src={teamLogo} alt={s.teamAbbrev} width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 hover:scale-105 transition-transform" unoptimized />
          );
          return teamSlug ? (
            <Link href={`/nhl/${teamSlug}`} onClick={() => trackClick('journey-team-logo', teamSlug)} className="flex-shrink-0">
              {logoEl}
            </Link>
          ) : logoEl;
        })()}

        <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
          <span
            className="text-3xl sm:text-4xl font-bold tabular-nums"
            style={{ color: s.teamWins > s.opponentWins ? accent : s.teamWins === s.opponentWins ? strongText : mutedText }}
          >
            {s.teamWins}
          </span>
          <span className="text-sm" style={{ color: mutedText }}>—</span>
          <span
            className="text-3xl sm:text-4xl font-bold tabular-nums"
            style={{ color: s.opponentWins > s.teamWins ? strongText : mutedText }}
          >
            {s.opponentWins}
          </span>
        </div>

        {s.opponent.logo && (() => {
          const oppSlug = Object.entries(TEAMS).find(([, t]) => t.abbreviation === s.opponent.abbrev)?.[0];
          const logoEl = (
            <Image src={s.opponent.logo} alt={s.opponent.abbrev} width={80} height={80} className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 hover:scale-105 transition-transform" unoptimized />
          );
          return oppSlug ? (
            <Link href={`/nhl/${oppSlug}`} onClick={() => trackClick('journey-opponent-logo', oppSlug)} className="flex-shrink-0">
              {logoEl}
            </Link>
          ) : logoEl;
        })()}
      </div>


      {/* Stat grid: Series Win Odds / To Clinch / Regular Season H2H */}
      {(() => {
        const boxClass = 'rounded-xl p-2 sm:p-3 text-center border';
        const boxStyle: React.CSSProperties = {
          background: isGoatMode ? statBoxBg : 'linear-gradient(to bottom right, #eff6ff, #dbeafe)',
          borderColor: statBoxBorder,
        };
        const numClass = 'text-2xl sm:text-3xl font-bold';
        const labelClass = 'text-[10px] font-semibold mt-0.5 uppercase tracking-wide';

        const hasOddsData =
          !advanced && !eliminated && s.teamPointPctg != null && s.opponentPointPctg != null;
        const oddsNum = hasOddsData
          ? Math.round(
              computeSeriesWinProbability(
                s.teamPointPctg!,
                s.opponentPointPctg!,
                s.teamWins,
                s.opponentWins,
                s.teamHasHomeIce ?? true,
                {
                  teamGoalDiffPerGame: s.teamGoalDiffPerGame,
                  oppGoalDiffPerGame: s.opponentGoalDiffPerGame,
                  teamHomeWinPct: s.teamHomeWinPct,
                  teamRoadWinPct: s.teamRoadWinPct,
                  oppHomeWinPct: s.opponentHomeWinPct,
                  oppRoadWinPct: s.opponentRoadWinPct,
                }
              )
            )
          : null;

        const h2h = s.regularSeasonH2H;
        const h2hText =
          h2h && h2h.gamesPlayed > 0
            ? `${h2h.wins}-${h2h.losses}-${h2h.otLosses}`
            : '—';

        return (
          <div className="relative grid grid-cols-3 gap-2 mb-4">
            <div className={boxClass} style={boxStyle}>
              <div className={numClass} style={{ color: advanced ? accent : eliminated ? mutedText : accent }}>
                {advanced ? '100%' : eliminated ? '0%' : oddsNum != null ? `${oddsNum}%` : '—'}
              </div>
              <div className={labelClass} style={{ color: subText }}>
                Win Odds
              </div>
            </div>
            <div className={boxClass} style={boxStyle}>
              <div className={numClass} style={{ color: eliminated ? mutedText : accent }}>
                {advanced || eliminated ? '—' : remainingToClinch}
              </div>
              <div className={labelClass} style={{ color: subText }}>
                To Clinch
              </div>
            </div>
            <div className={boxClass} style={boxStyle}>
              <div className={numClass} style={{ color: strongText }}>
                {h2hText}
              </div>
              <div className={labelClass} style={{ color: subText }}>
                Reg. Season
              </div>
            </div>
          </div>
        );
      })()}

      {/* Status pill — only shown once the series has started (or finished) */}
      {showPill && (
        <div className="relative flex justify-center mb-4">
          <span
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs sm:text-sm font-semibold border"
            style={pillStyle}
          >
            {pillText}
          </span>
        </div>
      )}

      {/* Games grid (same visual language as regular-season GameBox) */}
      {s.games.length > 0 ? (
        <div className="relative border-t pt-4" style={{ borderColor: isGoatMode ? darkModeColors.border : '#f3f4f6' }}>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {s.games.map((g) => (
              <PlayoffGameBox
                key={g.gameId || g.gameNumber}
                g={g}
                opponent={s.opponent}
                teamAbbrev={s.teamAbbrev}
                teamColors={teamColors}
                darkModeColors={darkModeColors}
                isGoatMode={isGoatMode}
              />
            ))}

            {/* Filler cards — quieter than game cards (dashed border, plain bg, no shadow, muted captions) */}
            {(() => {
              const teamCfg = Object.values(TEAMS).find((t) => t.abbreviation === s.teamAbbrev);
              const fillerBg = isGoatMode
                ? (darkModeColors.cardBackground ? `${darkModeColors.cardBackground}80` : '#18181b')
                : '#ffffff';
              const fillerBorder: React.CSSProperties = {
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: isGoatMode ? `${darkModeColors.border}80` : '#e5e7eb',
              };
              const fillerBase = 'h-full min-h-[260px] rounded-xl p-3 md:p-4 flex flex-col items-center justify-center text-center gap-2';
              const fillerStyle: React.CSSProperties = { ...fillerBorder, background: fillerBg };
              const captionClass = 'text-[10px] font-bold uppercase tracking-wider';
              const headlineClass = 'text-sm font-bold';
              const descClass = 'text-[11px] leading-snug px-1';
              const subtleText = isGoatMode ? `${darkModeColors.text}99` : '#6b7280';
              const mutedCaption = isGoatMode ? `${darkModeColors.text}66` : '#9ca3af';
              const strongFillText = isGoatMode ? darkModeColors.text : '#374151';
              const accent = isGoatMode ? darkModeColors.accent : teamColors.primary;
              // Outline button styling — quieter than the solid game-box CTAs
              const outlineButtonClass = 'mt-1 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded border-2 transition-colors';
              const outlineButtonStyle: React.CSSProperties = {
                borderColor: accent,
                color: accent,
                backgroundColor: 'transparent',
              };

              const ShopGearCard = (mobileOnly: boolean) => {
                if (!teamCfg) return null;
                const merchLink = generateAmazonMerchLink(teamCfg.city, teamCfg.name, 'nhl');
                return (
                  <div
                    className={`${fillerBase} ${mobileOnly ? 'sm:hidden' : 'hidden sm:flex'}`}
                    style={fillerStyle}
                  >
                    <p className={captionClass} style={{ color: mutedCaption }}>Shop</p>
                    <p className={headlineClass} style={{ color: strongFillText }}>
                      {teamCfg.name} Gear
                    </p>
                    <p className={descClass} style={{ color: subtleText }}>
                      Rep your team this playoff run.
                    </p>
                    <a
                      href={merchLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => trackClick('merch', `${teamCfg.city}-${teamCfg.name}`.toLowerCase().replace(/\s+/g, '-'))}
                      className={outlineButtonClass}
                      style={outlineButtonStyle}
                    >
                      <ShoppingBag size={12} className="sm:hidden" />
                      Shop Gear
                    </a>
                  </div>
                );
              };

              return (
                <>
                  {/* Mobile: Full Playoff Bracket card fills the odd empty cell */}
                  {s.games.length % 2 === 1 && (
                    <Link
                      href="/playoffs"
                      onClick={() => trackClick('bracket-cta', 'playoff-journey')}
                      className={`${fillerBase} sm:hidden transition-transform hover:scale-[1.02]`}
                      style={fillerStyle}
                    >
                      <p className={captionClass} style={{ color: mutedCaption }}>Explore</p>
                      <p className={headlineClass} style={{ color: strongFillText }}>Full Playoff Bracket</p>
                      <p className={descClass} style={{ color: subtleText }}>
                        All 8 series, live results.
                      </p>
                      <span className={outlineButtonClass} style={outlineButtonStyle}>
                        View Bracket
                      </span>
                    </Link>
                  )}

                  {/* Desktop: trio of filler cards (Shop Gear / Newsletter / Bracket) */}
                  {ShopGearCard(false)}

                  <div className={`${fillerBase} hidden sm:flex`} style={fillerStyle}>
                    <p className={captionClass} style={{ color: mutedCaption }}>Stay Updated</p>
                    <p className={headlineClass} style={{ color: strongFillText }}>Playoff Recap Emails</p>
                    <p className={descClass} style={{ color: subtleText }}>
                      After every game, in your inbox.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        trackClick('newsletter-cta', 'playoff-journey');
                        if (typeof window !== 'undefined') {
                          window.dispatchEvent(new CustomEvent('team-starred', { detail: { teamId: teamCfg?.id } }));
                        }
                      }}
                      className={outlineButtonClass}
                      style={outlineButtonStyle}
                    >
                      Subscribe
                    </button>
                  </div>

                  <Link
                    href="/playoffs"
                    onClick={() => trackClick('bracket-cta', 'playoff-journey')}
                    className={`${fillerBase} hidden sm:flex transition-transform hover:scale-[1.02]`}
                    style={fillerStyle}
                  >
                    <p className={captionClass} style={{ color: mutedCaption }}>Explore</p>
                    <p className={headlineClass} style={{ color: strongFillText }}>Full Playoff Bracket</p>
                    <p className={descClass} style={{ color: subtleText }}>
                      All 8 series, live results.
                    </p>
                    <span className={outlineButtonClass} style={outlineButtonStyle}>
                      View Bracket
                    </span>
                  </Link>
                </>
              );
            })()}
          </div>
        </div>
      ) : (
        <div className="relative border-t pt-4 text-center text-xs" style={{ borderColor: isGoatMode ? darkModeColors.border : '#f3f4f6', color: mutedText }}>
          Schedule coming soon
        </div>
      )}
    </div>
  );
}

// --- Single playoff game box — mirrors regular-season GameBox structure, styling, and functionality ---
function PlayoffGameBox({
  g,
  opponent,
  teamAbbrev,
  teamColors,
  darkModeColors,
  isGoatMode,
}: {
  g: JourneyGame;
  opponent: { abbrev: string; name: string; logo: string };
  teamAbbrev: string;
  teamColors: TeamColors;
  darkModeColors: DarkModeColors;
  isGoatMode: boolean;
}) {
  const router = useRouter();
  const outcome = gameOutcomeForTeam(g, teamAbbrev);
  const isFinal = g.gameState === 'FINAL' || g.gameState === 'OFF';
  const isLive = g.gameState === 'LIVE' || g.gameState === 'CRIT';
  const isTbd = g.gameScheduleState === 'TBD';
  const isPending = !isFinal && !isLive;
  const isHome = g.homeTeam.abbrev === teamAbbrev;
  const teamScore = isHome ? g.homeTeam.score : g.awayTeam.score;
  const oppScore = isHome ? g.awayTeam.score : g.homeTeam.score;
  const periodSuffix = g.gameOutcome?.lastPeriodType === 'OT' ? ' (OT)' : g.gameOutcome?.lastPeriodType === 'SO' ? ' (SO)' : g.gameOutcome?.lastPeriodType && g.gameOutcome.lastPeriodType !== 'REG' ? ` (${g.gameOutcome.lastPeriodType})` : '';

  const teamPrimaryColor = isGoatMode ? darkModeColors.accent : teamColors.primary;
  const isWin = outcome === 'W';
  const isLoss = outcome === 'L';

  // Border: solid team color for wins, dashed gray for losses, solid red for LIVE, neutral for upcoming
  let borderStyle: React.CSSProperties = { borderWidth: 2 };
  if (isWin) {
    borderStyle = { borderWidth: 2, borderStyle: 'solid', borderColor: isGoatMode ? darkModeColors.border : teamColors.primary };
  } else if (isLoss) {
    borderStyle = { borderWidth: 2, borderStyle: 'dashed', borderColor: isGoatMode ? darkModeColors.border : '#d1d5db' };
  } else if (isLive) {
    borderStyle = { borderWidth: 2, borderStyle: 'solid', borderColor: '#dc2626' };
  } else {
    borderStyle = { borderWidth: 2, borderStyle: 'solid', borderColor: isGoatMode ? darkModeColors.border : '#e5e7eb' };
  }

  const cardBg = isGoatMode
    ? (darkModeColors.cardBackground
        ? `linear-gradient(to bottom right, ${darkModeColors.cardBackground}f8, ${darkModeColors.cardBackground}f0)`
        : 'linear-gradient(to bottom right, #27272a, #18181b)')
    : 'linear-gradient(to bottom right, #eff6ff, #f8fafc)';

  const shadowClass = isWin ? 'shadow-lg' : 'shadow-md';
  const opacity = isLoss ? 'opacity-75' : 'opacity-100';

  // Opponent team config for logo navigation + ticket link
  const opponentTeam = Object.values(TEAMS).find((t) => t.abbreviation === opponent.abbrev);
  const opponentSlug = opponentTeam?.id || null;
  const homeTeam = isHome
    ? Object.values(TEAMS).find((t) => t.abbreviation === teamAbbrev)
    : opponentTeam;
  const ticketLink =
    isPending && homeTeam && g.startTimeUTC
      ? generateGameTicketLink(
          homeTeam.slug,
          homeTeam.city,
          homeTeam.stubhubId,
          isHome ? teamAbbrev : opponent.abbrev,
          isHome ? opponent.abbrev : teamAbbrev,
          g.startTimeUTC
        )
      : null;

  const getOutcomeText = () => {
    if (isWin) return 'WIN';
    if (isLoss) return 'LOSS';
    return 'UPCOMING';
  };

  // Date formatting
  const gameDate = g.startTimeUTC ? new Date(g.startTimeUTC) : null;
  const weekdayStr = gameDate ? gameDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' }) : '';
  const dateStr = gameDate ? gameDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const timeStr = gameDate && !isTbd ? gameDate.toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }) : '';
  const finalDateStr = gameDate ? gameDate.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric' }) : '';

  const subText = isGoatMode ? `${darkModeColors.text}99` : '#6b7280';
  const mutedText = isGoatMode ? `${darkModeColors.text}66` : '#9ca3af';
  const strongText = isGoatMode ? darkModeColors.text : '#1f2937';

  const cardContent = (
    <div
      className={`h-full min-h-[260px] rounded-xl p-2.5 md:p-3 transition-all hover:shadow-lg ${shadowClass} ${opacity} flex flex-col`}
      style={{ ...borderStyle, background: cardBg }}
    >
      {/* Game number + HOME/AWAY */}
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold" style={{ color: subText }}>
          Gm {g.gameNumber}
        </span>
        <span className="text-xs font-bold" style={{ color: teamPrimaryColor }}>
          {isHome ? 'HOME' : 'AWAY'}
        </span>
      </div>

      {/* Opponent label + logo */}
      <div className="text-center mb-2">
        <div className="text-xs font-semibold mb-1.5" style={{ color: subText }}>
          {isHome ? 'vs' : '@'}
        </div>
        <div className="flex flex-col items-center gap-1.5">
          {opponentSlug ? (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                trackClick('opponent-logo', opponentSlug);
                router.push(`/nhl/${opponentSlug}`);
              }}
              className="rounded-lg p-1.5 md:p-2 shadow-sm border transition-transform hover:scale-110 cursor-pointer"
              style={{
                backgroundColor: isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : '#ffffff',
                borderColor: isGoatMode ? darkModeColors.border : '#e5e7eb',
              }}
              title={`View ${opponent.name} tracker`}
            >
              {opponent.logo && (
                <img src={opponent.logo} alt={opponent.abbrev} className="w-14 h-14 md:w-12 md:h-12 object-contain" />
              )}
            </button>
          ) : (
            <div
              className="rounded-lg p-1.5 md:p-2 shadow-sm border"
              style={{
                backgroundColor: isGoatMode ? darkModeColors.cardBackground || darkModeColors.background : '#ffffff',
                borderColor: isGoatMode ? darkModeColors.border : '#e5e7eb',
              }}
            >
              {opponent.logo && (
                <img src={opponent.logo} alt={opponent.abbrev} className="w-14 h-14 md:w-12 md:h-12 object-contain" />
              )}
            </div>
          )}
          <div className="text-sm font-bold" style={{ color: strongText }}>{opponent.abbrev}</div>
        </div>
      </div>

      {/* Score section (for final + live) OR upcoming status */}
      {isFinal || isLive ? (
        <>
          <div className="flex justify-center items-center gap-2 md:gap-3 mb-2">
            <div className="text-center">
              <div className="text-xs font-semibold mb-1" style={{ color: subText }}>{teamAbbrev}</div>
              <div className="text-3xl md:text-3xl font-bold" style={{ color: strongText }}>{teamScore ?? 0}</div>
            </div>
            <div className="text-xl md:text-2xl font-light" style={{ color: mutedText }}>-</div>
            <div className="text-center">
              <div className="text-xs font-semibold mb-1" style={{ color: subText }}>{opponent.abbrev}</div>
              <div className="text-3xl md:text-3xl font-bold" style={{ color: strongText }}>{oppScore ?? 0}</div>
            </div>
          </div>

          <div className="text-center pt-2 border-t-2" style={{ borderColor: isGoatMode ? darkModeColors.border : '#e5e7eb' }}>
            {isLive ? (() => {
              const livePeriod = g.period || 1;
              const livePeriodType = g.periodDescriptor?.periodType || 'REG';
              const liveIsIntermission = g.clock?.inIntermission || false;
              const liveTimeRemaining = g.clock?.timeRemaining || '20:00';
              const getOrdinalPeriod = (num: number, type: string): string => {
                if (type === 'OT') return 'Overtime';
                if (type === 'SO') return 'Shootout';
                const ordinals = ['', '1st', '2nd', '3rd', '4th'];
                return `${ordinals[num] || `${num}th`} Period`;
              };
              const livePeriodText = getOrdinalPeriod(livePeriod, livePeriodType);
              return (
                <>
                  <div className="text-sm font-bold" style={{ color: teamPrimaryColor }}>
                    {liveIsIntermission ? `End of ${livePeriodText}` : livePeriodText}
                  </div>
                  {!liveIsIntermission && (
                    <div className={`text-xs font-semibold mt-1 ${isGoatMode ? 'text-zinc-400' : 'text-gray-600'}`}>
                      {liveTimeRemaining}
                    </div>
                  )}
                  <div className="mt-2 flex justify-center">
                    {liveIsIntermission ? (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-orange-500 animate-pulse">
                        INTERMISSION
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold text-white bg-red-600 animate-pulse">
                        LIVE
                      </span>
                    )}
                  </div>
                </>
              );
            })() : (
              <div className="text-sm font-bold" style={{ color: teamPrimaryColor }}>
                {getOutcomeText()}{periodSuffix}
              </div>
            )}
            {finalDateStr && !isLive && (
              <div className="text-xs mt-1" style={{ color: subText }}>{finalDateStr}</div>
            )}
          </div>
        </>
      ) : (
        <div className="text-center py-3">
          {!g.startTimeUTC ? (
            // No date/time info at all (e.g. "if necessary" games) — compact fallback
            <>
              <div className="text-sm font-semibold mb-2" style={{ color: strongText }}>
                {g.ifNecessary ? 'If necessary' : 'TBD'}
              </div>
              <div className="text-xs font-medium" style={{ color: subText }}>Upcoming Game</div>
            </>
          ) : (
            // Date known (even if scheduleState === 'TBD' — NHL supplies a placeholder date); show "TBD" for time if unconfirmed
            <>
              <div className="text-xs font-semibold mb-1" style={{ color: subText }}>{weekdayStr}</div>
              <div className="text-sm font-semibold mb-2" style={{ color: strongText }}>{dateStr}</div>
              <div className="text-xs font-semibold mb-2" style={{ color: teamPrimaryColor }}>
                {isTbd ? 'TBD' : timeStr}
              </div>
              <div className="text-xs font-medium mb-2" style={{ color: subText }}>Upcoming Game</div>
              {ticketLink && (
                <a
                  href={ticketLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    trackClick('ticket', opponent.abbrev);
                  }}
                  className="inline-block px-3 py-1.5 text-xs font-bold rounded transition-all shadow-sm hover:shadow-md text-white"
                  style={{
                    background: isGoatMode
                      ? `linear-gradient(to right, #b91c1c, #991b1b)`
                      : `linear-gradient(to right, ${teamColors.primary}, ${teamColors.primary}dd)`,
                  }}
                >
                  Get Tickets
                </a>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );

  // Wrapping: TBD/no-id → plain div, upcoming with ticket link → use onClick to avoid nested <a>, else Link
  if (isTbd || !g.gameId) {
    return <div className="h-full">{cardContent}</div>;
  }
  if (ticketLink) {
    const gameLink = `/nhl/scores/${g.gameId}`;
    return (
      <div
        className="block h-full cursor-pointer"
        onClick={() => router.push(gameLink)}
        role="link"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') router.push(gameLink);
        }}
      >
        {cardContent}
      </div>
    );
  }
  return (
    <Link href={`/nhl/scores/${g.gameId}`} className="block h-full">
      {cardContent}
    </Link>
  );
}

export default function PlayoffJourney({
  series,
  teamAbbrev,
  teamName,
  teamLogo,
  teamColors,
  darkModeColors,
  isGoatMode,
  cupOdds,
  cupOddsRank,
}: PlayoffJourneyProps) {
  if (series.length === 0) return null;
  const ordered = [...series].sort((a, b) => a.roundNumber - b.roundNumber);

  // Cumulative wins per round (R1, R2, CF, SCF) — drives the Road to the Cup card.
  const roundWins = [0, 0, 0, 0];
  for (const s of ordered) {
    if (s.roundNumber >= 1 && s.roundNumber <= 4) {
      roundWins[s.roundNumber - 1] = s.teamWins;
    }
  }
  const activeSeries = ordered[ordered.length - 1];

  return (
    <div className="mb-4 mt-4">
      <div className="grid grid-cols-1 gap-4">
        <CupWinsCard
          roundWins={roundWins}
          activeSeries={activeSeries}
          teamColors={teamColors}
          darkModeColors={darkModeColors}
          isGoatMode={isGoatMode}
          cupOdds={cupOdds}
          cupOddsRank={cupOddsRank}
        />
        {ordered.map((s) => (
          <SeriesCard
            key={s.seriesLetter}
            s={s}
            teamName={teamName}
            teamLogo={teamLogo}
            teamColors={teamColors}
            darkModeColors={darkModeColors}
            isGoatMode={isGoatMode}
          />
        ))}
      </div>
    </div>
  );
}
