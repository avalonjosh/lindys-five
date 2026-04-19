'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronDown } from 'lucide-react';
import { fetchBoxScoreData } from '@/lib/services/boxscoreApi';
import type {
  BoxscoreResponse,
  LandingResponse,
  ScoringPeriod,
  ScoringGoal,
  ThreeStar,
  BoxscoreGoalie,
} from '@/lib/types/boxscore';

interface InlineBoxscoreProps {
  gameId: string;
}

interface LoadedData {
  boxscore: BoxscoreResponse;
  landing: LandingResponse;
}

function periodLabel(p: { number: number; periodType: string }): string {
  if (p.periodType === 'OT') return p.number > 4 ? `${p.number - 3}OT` : 'OT';
  if (p.periodType === 'SO') return 'Shootout';
  const ord = ['1st', '2nd', '3rd'];
  return `${ord[p.number - 1] ?? `${p.number}th`} Period`;
}

function strengthLabel(strength: string): string | null {
  const s = (strength || '').toLowerCase();
  if (s === 'pp') return 'PP';
  if (s === 'sh') return 'SH';
  if (s === 'en') return 'EN';
  return null;
}

function parseGoalieLine(raw: string | undefined): { saves: number; shots: number } | null {
  if (!raw) return null;
  // NHL API has used both "SV-SA" and "SV/SA" formats depending on endpoint/era.
  const [sv, sa] = raw.split(/[-/]/).map((n) => Number(n));
  if (Number.isNaN(sv) || Number.isNaN(sa)) return null;
  return { saves: sv, shots: sa };
}

function didGoaliePlay(g: BoxscoreGoalie): boolean {
  const parsed = parseGoalieLine(g.saveShotsAgainst);
  const shots = g.shotsAgainst ?? parsed?.shots ?? 0;
  // A goalie with 0 shots against and no decision didn't actually play (dressed as backup).
  return shots > 0 || !!g.decision;
}

function formatSvPct(pct: number | undefined, saves?: number, shots?: number): string {
  let v = pct;
  if (v == null && saves != null && shots && shots > 0) v = saves / shots;
  if (v == null) return '—';
  return v.toFixed(3).replace(/^0/, '');
}

function threeStarName(s: ThreeStar): string {
  const fn = s.firstName?.default;
  const ln = s.lastName?.default;
  if (fn && ln) return `${fn} ${ln}`;
  return s.name?.default ?? 'Unknown';
}

function threeStarTeam(s: ThreeStar): string {
  return typeof s.teamAbbrev === 'string' ? s.teamAbbrev : s.teamAbbrev?.default ?? '';
}

function threeStarStatLine(s: ThreeStar): string {
  // Goalies: landing returns goalsAgainstAverage + savePctg; skaters: goals/assists/points.
  // Historical games often omit skater stats on three stars; fall back gracefully.
  const ext = s as ThreeStar & { goalsAgainstAverage?: number; savePctg?: number };
  if (s.position === 'G' || (s.goals == null && ext.savePctg != null)) {
    const parts: string[] = [];
    if (ext.goalsAgainstAverage != null) parts.push(`${ext.goalsAgainstAverage.toFixed(2)} GAA`);
    if (ext.savePctg != null) parts.push(`${ext.savePctg.toFixed(3).replace(/^0/, '')} SV%`);
    return parts.join(' · ');
  }
  if (s.goals != null && s.assists != null) {
    const pts = s.points ?? s.goals + s.assists;
    return `${s.goals}G ${s.assists}A ${pts}P`;
  }
  return '';
}

export default function InlineBoxscore({ gameId }: InlineBoxscoreProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [data, setData] = useState<LoadedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (!isOpen || fetchedRef.current) return;
    fetchedRef.current = true;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchBoxScoreData(gameId, controller.signal)
      .then((res) => {
        setData(res);
        setLoading(false);
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        setError('Box score data is not available for this game.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [isOpen, gameId]);

  const scoring: ScoringPeriod[] = data?.landing.summary?.scoring ?? [];
  const threeStars: ThreeStar[] = data?.landing.summary?.threeStars ?? [];
  const goaliesHome: BoxscoreGoalie[] = (data?.boxscore.playerByGameStats?.homeTeam?.goalies ?? []).filter(didGoaliePlay);
  const goaliesAway: BoxscoreGoalie[] = (data?.boxscore.playerByGameStats?.awayTeam?.goalies ?? []).filter(didGoaliePlay);
  const homeAbbrev = data?.boxscore.homeTeam.abbrev ?? '';
  const awayAbbrev = data?.boxscore.awayTeam.abbrev ?? '';
  const homeSOG = data?.boxscore.homeTeam.sog;
  const awaySOG = data?.boxscore.awayTeam.sog;

  const hasAnyContent =
    scoring.length > 0 ||
    threeStars.length > 0 ||
    goaliesHome.length > 0 ||
    goaliesAway.length > 0 ||
    homeSOG != null;

  return (
    <details
      className="group mt-3 rounded-md border border-gray-200 bg-white"
      onToggle={(e) => setIsOpen((e.currentTarget as HTMLDetailsElement).open)}
    >
      <summary className="cursor-pointer list-none flex items-center justify-between px-3 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:text-gray-900">
        <span>Box score</span>
        <ChevronDown
          size={16}
          className="text-gray-400 transition-transform duration-200 group-open:rotate-180"
        />
      </summary>

      {isOpen && (
        <div className="border-t border-gray-100 px-3 py-3 text-xs sm:text-sm">
          {loading && (
            <p className="text-gray-500 py-2 text-center">Loading box score…</p>
          )}
          {!loading && error && (
            <p className="text-gray-500 py-2 text-center">{error}</p>
          )}
          {!loading && !error && data && !hasAnyContent && (
            <p className="text-gray-500 py-2 text-center">
              Box score data is not available for this game.
            </p>
          )}
          {!loading && !error && data && hasAnyContent && (
            <div>
              {homeSOG != null && awaySOG != null && (
                <section className="first:border-t-0 first:pt-0 border-t border-gray-200 pt-4 mt-4 first:mt-0">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Shots on Goal
                  </h4>
                  <div className="flex items-baseline justify-between gap-3 text-gray-900 bg-gray-50 px-2 py-1">
                    <span className="font-medium">
                      {awayAbbrev}{' '}
                      <span className="tabular-nums font-bold">{awaySOG}</span>
                    </span>
                    <span className="text-gray-400">—</span>
                    <span className="font-medium">
                      <span className="tabular-nums font-bold">{homeSOG}</span>{' '}
                      {homeAbbrev}
                    </span>
                  </div>
                </section>
              )}

              {scoring.length > 0 && (
                <section className="first:border-t-0 first:pt-0 border-t border-gray-200 pt-4 mt-4 first:mt-0">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Scoring
                  </h4>
                  <div className="space-y-3">
                    {scoring.map((period) => (
                      <div key={`p-${period.periodDescriptor.number}-${period.periodDescriptor.periodType}`}>
                        <p className="text-[10px] sm:text-xs font-semibold text-gray-600 mb-1">
                          {periodLabel(period.periodDescriptor)}
                        </p>
                        <ul>
                          {period.goals.length === 0 ? (
                            <li className="px-2 py-1 text-gray-400 italic">No goals</li>
                          ) : (
                            period.goals.map((g, i) => (
                              <GoalLine key={`g-${i}-${g.timeInPeriod}`} goal={g} />
                            ))
                          )}
                        </ul>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {threeStars.length > 0 && (
                <section className="first:border-t-0 first:pt-0 border-t border-gray-200 pt-4 mt-4 first:mt-0">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Three Stars
                  </h4>
                  <ul>
                    {threeStars
                      .slice()
                      .sort((a, b) => a.star - b.star)
                      .map((s) => {
                        const statLine = threeStarStatLine(s);
                        return (
                          <li
                            key={s.star}
                            className="flex items-baseline gap-2 flex-wrap px-2 py-1 odd:bg-gray-50"
                          >
                            <span className="text-amber-500 font-semibold">
                              {'★'.repeat(s.star)}
                            </span>
                            <span className="font-medium text-gray-900">
                              {threeStarName(s)}
                            </span>
                            <span className="text-gray-500">
                              ({threeStarTeam(s)})
                            </span>
                            {statLine && (
                              <span className="text-gray-500 ml-auto tabular-nums">
                                {statLine}
                              </span>
                            )}
                          </li>
                        );
                      })}
                  </ul>
                </section>
              )}

              {(goaliesAway.length > 0 || goaliesHome.length > 0) && (
                <section className="first:border-t-0 first:pt-0 border-t border-gray-200 pt-4 mt-4 first:mt-0">
                  <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Goalies
                  </h4>
                  <ul>
                    {goaliesAway.map((g) => (
                      <GoalieLine key={`a-${g.playerId}`} goalie={g} teamAbbrev={awayAbbrev} />
                    ))}
                    {goaliesHome.map((g) => (
                      <GoalieLine key={`h-${g.playerId}`} goalie={g} teamAbbrev={homeAbbrev} />
                    ))}
                  </ul>
                </section>
              )}

              <div className="pt-4 mt-4 border-t border-gray-200">
                <Link
                  href={`/scores/${gameId}`}
                  className="inline-flex items-center text-xs sm:text-sm text-blue-600 hover:text-blue-800 hover:underline"
                >
                  View full box score →
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </details>
  );
}

function GoalLine({ goal }: { goal: ScoringGoal }) {
  const scorer = `${goal.firstName.default} ${goal.lastName.default}`;
  const assists = goal.assists
    .map((a) => `${a.firstName.default} ${a.lastName.default}`)
    .join(', ');
  const strength = strengthLabel(goal.strength);

  return (
    <li className="flex items-baseline gap-2 flex-wrap px-2 py-1 odd:bg-gray-50">
      <span className="text-gray-500 tabular-nums w-10 flex-shrink-0">
        {goal.timeInPeriod}
      </span>
      <span className="font-semibold text-gray-600 w-10 flex-shrink-0">
        {goal.teamAbbrev.default}
      </span>
      <span className="text-gray-900 flex-1 min-w-0">
        <span className="font-medium">{scorer}</span>
        {assists && <span className="text-gray-500"> ({assists})</span>}
      </span>
      {strength && (
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-700 bg-amber-100 rounded-full px-1.5 py-0.5 flex-shrink-0">
          {strength}
        </span>
      )}
    </li>
  );
}

function GoalieLine({
  goalie,
  teamAbbrev,
}: {
  goalie: BoxscoreGoalie;
  teamAbbrev: string;
}) {
  const parsed = parseGoalieLine(goalie.saveShotsAgainst);
  const saves = goalie.saves ?? parsed?.saves;
  const shots = goalie.shotsAgainst ?? parsed?.shots;
  const svPct = formatSvPct(goalie.savePctg, saves, shots);

  return (
    <li className="flex items-baseline gap-2 flex-wrap px-2 py-1 odd:bg-gray-50">
      <span className="font-semibold text-gray-600 w-10 flex-shrink-0">
        {teamAbbrev}
      </span>
      <span className="font-medium text-gray-900 flex-1 min-w-0">
        {goalie.name.default}
      </span>
      {goalie.decision && (
        <span
          className={`text-[10px] font-bold uppercase tracking-wider rounded-full px-1.5 py-0.5 flex-shrink-0 ${
            goalie.decision === 'W'
              ? 'bg-emerald-100 text-emerald-700'
              : goalie.decision === 'L'
                ? 'bg-rose-100 text-rose-700'
                : 'bg-gray-100 text-gray-700'
          }`}
        >
          {goalie.decision}
        </span>
      )}
      <span className="text-gray-600 tabular-nums flex-shrink-0">
        {saves != null && shots != null ? `${saves}/${shots}` : '—'}
      </span>
      <span className="text-gray-500 tabular-nums flex-shrink-0">{svPct}</span>
    </li>
  );
}
