import Link from 'next/link';
import MLBGameBox from './MLBGameBox';
import type { MLBGameResult } from '@/lib/types/mlb';
import MerchCTA from '@/components/affiliate/MerchCTA';
import type { MLBPostseason, PostseasonGame, PostseasonRound, PostseasonSeries } from '@/lib/services/mlbPostseason';

/**
 * MLB postseason mode for team pages, mirroring the NHL Playoff Journey:
 * a "Road to the World Series" hero (wins needed, World Series odds) and one
 * card per series (score, series odds, wins to clinch, head-to-head, games).
 */

interface TeamColors {
  primary: string;
  secondary: string;
  accent: string;
}

const ROUND_LABEL: Record<PostseasonRound, string> = { F: 'Wild Card', D: 'Division Series', L: 'Championship Series', W: 'World Series' };
const ROUND_TAG: Record<PostseasonRound, string> = { F: 'WC', D: 'DS', L: 'CS', W: 'WS' };
const ROUND_WINS: Record<PostseasonRound, number> = { F: 2, D: 3, L: 4, W: 4 };
const NEXT_ROUND: Record<PostseasonRound, string> = { F: 'Division Series', D: 'Championship Series', L: 'World Series', W: '' };

const statBox = 'rounded-xl p-2 md:p-3 border';
const statBoxStyle = { background: 'linear-gradient(to bottom right, #eff6ff, #dbeafe)', borderColor: '#bfdbfe' };

const ordinal = (n: number) => {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function RoadCard({ ps, teamName, colors }: { ps: MLBPostseason; teamName: string; colors: TeamColors }) {
  const current = ps.series[ps.series.length - 1];
  const rounds: PostseasonRound[] = ps.winsNeeded === 13 ? ['F', 'D', 'L', 'W'] : ['D', 'L', 'W'];
  const winsIn = (r: PostseasonRound) => Math.min(ps.series.find((s) => s.round === r)?.teamWins ?? 0, ROUND_WINS[r]);
  const total = rounds.reduce((sum, r) => sum + winsIn(r), 0);
  const toClinch = Math.max(0, Math.ceil(current.bestOf / 2) - current.teamWins);

  let milestone: string;
  if (ps.champion) milestone = 'World Series Champions';
  else if (ps.eliminated) milestone = `Eliminated in the ${ROUND_LABEL[current.round]}`;
  else if (ps.wsRank) milestone = ps.wsRank.rank === 1 ? 'Best World Series odds' : `${ordinal(ps.wsRank.rank)}-best World Series odds`;
  else if (current.state === 'won') milestone = `Won the ${ROUND_LABEL[current.round]}, on to the ${NEXT_ROUND[current.round]}`;
  else milestone = toClinch === 1 ? `1 win from clinching the ${ROUND_LABEL[current.round]}` : `${toClinch} wins to clinch the ${ROUND_LABEL[current.round]}`;

  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-lg sm:p-5">
      <h3 className="mb-3 text-xl font-bold text-gray-900 md:mb-4 md:text-2xl">Road to the World Series</h3>

      <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3 md:mb-4 md:gap-3">
        <div className={`${statBox} hidden sm:block`} style={statBoxStyle}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Current Round</div>
          <div className="text-xl font-bold leading-tight text-gray-900 md:text-2xl">{ROUND_LABEL[current.round]}</div>
          <div className="mt-1 text-xs text-gray-500">best of {current.bestOf}</div>
        </div>
        <div className={statBox} style={statBoxStyle}>
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">Postseason Wins</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">{ps.wins}</div>
          <div className="mt-1 text-xs text-gray-500">of {ps.winsNeeded} needed</div>
        </div>
        <Link href="/mlb/watch" className={`${statBox} block transition-shadow hover:shadow-md`} style={statBoxStyle} title="MLB playoffs TV schedule">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600">World Series Odds</div>
          <div className="text-2xl font-bold text-gray-900 md:text-3xl">
            {ps.wsOdds == null ? '—' : ps.wsOdds < 1 && !ps.eliminated && !ps.champion ? '<1%' : `${ps.wsOdds}%`}
          </div>
          <div className="mt-1 text-xs text-gray-500">chance to win it all</div>
        </Link>
      </div>

      <div className="mb-1 flex justify-between px-0.5">
        {rounds.map((r) => (
          <div key={r} className="text-center" style={{ flex: ROUND_WINS[r] }}>
            <span className="text-xs font-bold uppercase tracking-wider" style={{ color: r === current.round ? colors.primary : '#9ca3af' }}>
              {ROUND_TAG[r]}
            </span>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5 sm:gap-2">
        {rounds.map((r) => {
          const active = r === current.round;
          const wins = winsIn(r);
          return (
            <div
              key={r}
              className="flex gap-0.5 rounded-md p-0.5"
              style={{ flex: ROUND_WINS[r], backgroundColor: active ? `${colors.primary}14` : 'transparent', outline: active ? `1px solid ${colors.primary}40` : 'none' }}
            >
              {Array.from({ length: ROUND_WINS[r] }).map((_, i) => (
                <div
                  key={i}
                  className={`h-6 flex-1 sm:h-7 ${i === 0 ? 'rounded-l-sm' : ''} ${i === ROUND_WINS[r] - 1 ? 'rounded-r-sm' : ''}`}
                  style={{
                    backgroundColor: i < wins ? colors.primary : 'transparent',
                    border: i < wins ? 'none' : `1.5px solid ${active ? `${colors.primary}55` : '#e5e7eb'}`,
                  }}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-baseline justify-center gap-2 text-xs text-gray-500 sm:justify-between md:text-sm">
        <span>
          <span className="font-bold" style={{ color: ps.champion ? '#d4af37' : '#111827' }}>{Math.round((total / ps.winsNeeded) * 100)}%</span> complete
        </span>
        <span className={`text-right font-semibold ${ps.wsRank ? 'hidden sm:inline-block' : ''}`} style={{ color: ps.champion ? '#d4af37' : ps.eliminated ? '#9ca3af' : colors.primary }}>
          {milestone}
        </span>
      </div>
      <p className="sr-only">{teamName} postseason: {milestone}.</p>
    </div>
  );
}

/** Playoff game in the regular-season card's shape, so both look the same. */
function toGameResult(g: PostseasonGame, s: PostseasonSeries): MLBGameResult {
  const final = g.state === 'final';
  return {
    date: g.dateShort,
    startTime: g.timeShort,
    opponent: s.oppAbbrev,
    opponentLogo: s.oppLogos[0] ?? '',
    isHome: g.isHome,
    teamScore: g.teamScore ?? 0,
    opponentScore: g.oppScore ?? 0,
    outcome: final ? ((g.teamScore ?? 0) > (g.oppScore ?? 0) ? 'W' : 'L') : 'PENDING',
    gameState: g.state === 'live' ? 'In Progress' : final ? 'Final' : 'Scheduled',
    gameId: g.gamePk,
    inning: g.inning,
    inningHalf: g.inningHalf,
  };
}

function SeriesCard({ s, teamName, teamAbbrev, teamLogo, teamSlug, teamCity, colors }: {
  s: PostseasonSeries;
  teamName: string;
  teamAbbrev: string;
  teamLogo: string;
  teamSlug: string;
  teamCity: string;
  colors: TeamColors;
}) {
  const won = s.state === 'won';
  const lost = s.state === 'lost';
  const border = won
    ? { borderColor: colors.primary, borderStyle: 'solid' as const }
    : lost
      ? { borderColor: '#d1d5db', borderStyle: 'dashed' as const }
      : { borderColor: '#e5e7eb', borderStyle: 'solid' as const };
  const toClinch = Math.max(0, Math.ceil(s.bestOf / 2) - s.teamWins);

  return (
    <div className="relative rounded-2xl border-2 bg-white p-4 shadow-lg sm:p-5" style={border}>
      <div className="mb-3 flex justify-center sm:absolute sm:left-5 sm:top-5 sm:mb-0 sm:block">
        <span
          className="inline-block rounded-full px-4 py-1.5 text-lg tracking-[0.15em] text-white shadow-sm sm:text-base"
          style={{ backgroundColor: colors.primary, fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {s.short.toUpperCase()}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-center gap-4 sm:gap-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={teamLogo} alt={teamName} className="h-16 w-16 flex-shrink-0 sm:h-20 sm:w-20" />
        <div className="flex items-center gap-2">
          <span className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: s.teamWins > s.oppWins ? colors.primary : s.teamWins === s.oppWins ? '#111827' : '#9ca3af' }}>{s.teamWins}</span>
          <span className="text-sm text-gray-400">-</span>
          <span className="text-3xl font-bold tabular-nums sm:text-4xl" style={{ color: s.oppWins > s.teamWins ? '#111827' : '#9ca3af' }}>{s.oppWins}</span>
        </div>
        {s.oppLogo ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={s.oppLogo} alt={s.oppName} className="h-16 w-16 flex-shrink-0 sm:h-20 sm:w-20" />
        ) : s.oppLogos.length > 1 ? (
          <div className="flex flex-shrink-0 flex-col items-center gap-1" title={s.oppName}>
            <div className="flex gap-1">
              {s.oppLogos.map((src) => (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img key={src} src={src} alt="" className="h-9 w-9 opacity-80 sm:h-11 sm:w-11" />
              ))}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{s.oppAbbrev}</span>
          </div>
        ) : (
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full border-2 border-dashed border-gray-300 text-center text-[10px] font-bold leading-tight text-gray-400 sm:h-20 sm:w-20">
            {s.oppName}
          </div>
        )}
      </div>

      {(won || lost) && (
        <div className="mb-3 flex justify-center">
          <span
            className="rounded-full border px-3 py-1 text-sm font-bold"
            style={won
              ? { backgroundColor: `${colors.primary}20`, color: colors.primary, borderColor: `${colors.primary}50` }
              : { backgroundColor: '#f3f4f6', color: '#6b7280', borderColor: '#d1d5db' }}
          >
            {won
              ? s.round === 'W' ? `World Series Champions ${s.teamWins}-${s.oppWins}` : `Won ${s.teamWins}-${s.oppWins} → ${NEXT_ROUND[s.round]}`
              : `Eliminated ${s.teamWins}-${s.oppWins}`}
          </span>
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="rounded-xl border p-2 text-center sm:p-3" style={statBoxStyle}>
          <div className="text-2xl font-bold text-gray-900 sm:text-3xl">{s.winOdds == null ? '—' : `${s.winOdds}%`}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Series Win Odds</div>
        </div>
        <div className="rounded-xl border p-2 text-center sm:p-3" style={statBoxStyle}>
          <div className="text-2xl font-bold text-gray-900 sm:text-3xl">{won ? '✓' : lost ? '—' : toClinch}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">{won ? 'Clinched' : 'Wins to Clinch'}</div>
        </div>
        <div className="rounded-xl border p-2 text-center sm:p-3" style={statBoxStyle}>
          <div className="text-2xl font-bold text-gray-900 sm:text-3xl">{s.h2h ?? '—'}</div>
          <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">Regular Season H2H</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {s.games.map((g) => (
          <MLBGameBox
            key={g.gamePk}
            game={toGameResult(g, s)}
            gameNumber={g.gameNumber}
            label={`Game ${g.gameNumber}`}
            teamAbbreviation={teamAbbrev}
            teamColors={colors}
            opponentLogos={s.oppLogos}
            ticketLinkOverride={g.ticketLink ?? null}
            upcomingText={g.ifNecessary ? 'If Necessary' : undefined}
            extra={g.state === 'upcoming' && g.tv ? (
              <div className="mb-2 text-[11px] font-semibold text-gray-500">{g.tv}</div>
            ) : undefined}
          />
        ))}
      </div>

      {won && (
        <div className="mt-4">
          <MerchCTA teamCity={teamCity} teamName={teamName} sport="mlb" variant="card" primaryColor={colors.primary} teamSlug={teamSlug} placement="mlb-journey" />
        </div>
      )}
    </div>
  );
}

export default function MLBPlayoffJourney({ postseason, teamName, teamAbbrev, teamCity, teamLogo, teamSlug, colors }: {
  postseason: MLBPostseason;
  teamName: string;
  teamAbbrev: string;
  teamCity: string;
  teamLogo: string;
  teamSlug: string;
  colors: TeamColors;
}) {
  const newestFirst = [...postseason.series].reverse();
  return (
    <div className="mb-4 space-y-4">
      <RoadCard ps={postseason} teamName={teamName} colors={colors} />
      {newestFirst.map((s) => (
        <SeriesCard key={s.name} s={s} teamName={teamName} teamAbbrev={teamAbbrev} teamLogo={teamLogo} teamSlug={teamSlug} teamCity={teamCity} colors={colors} />
      ))}
      <p className="text-center text-xs">
        <Link href="/mlb/watch" className="font-semibold text-sabres-blue hover:underline">Full MLB playoffs TV schedule →</Link>
      </p>
    </div>
  );
}
