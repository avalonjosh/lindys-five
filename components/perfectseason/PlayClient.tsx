'use client';

import Link from 'next/link';
import type { Sport } from '@/lib/perfectseason/types';
import {
  canSkipDecade,
  canSkipTeam,
  currentSpin,
  legalSlots,
  openSlots,
  spinPlayers,
} from '@/lib/perfectseason/engine';
import { getStats, getStreak } from '@/lib/perfectseason/storage';
import RosterList from './RosterList';
import SpinReveal from './SpinReveal';
import PlayerList from './PlayerList';
import ResultCard from './ResultCard';
import DailyResult from './DailyResult';
import FranchisePicker from './FranchisePicker';
import HowToPlay from './HowToPlay';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';
import { SPORT_UI } from './sportUi';
import { usePerfectSeasonGame, type FreeType, type GameProps, type Source } from './usePerfectSeasonGame';

export type { ScheduleJson } from './usePerfectSeasonGame';

/**
 * MLB ("stacked", single-column) board layout. Game logic lives in
 * usePerfectSeasonGame; the NHL board renders a different layout on the same hook.
 */
export default function PlayClient(props: GameProps) {
  const { sport, data, config, defaultSpin } = props;
  const g = usePerfectSeasonGame(props);
  const {
    source,
    freeType,
    variant,
    state,
    phase,
    undo,
    record,
    type,
    mode,
    spinKey,
    setSource,
    setVariant,
    setPhase,
    setFranchiseId,
    commitAssign,
    onSkip,
    newGame,
    undoPick,
    chooseFreeType,
  } = g;

  const shellProps = { sport, source, freeType, onSource: setSource, onFreeType: chooseFreeType };

  // --- Daily result / lockout ---
  if (source === 'daily' && record) {
    return (
      <Shell {...shellProps}>
        <DailyResult
          record={record}
          config={config}
          variant={variant}
          streak={getStreak(sport, variant)}
          played={getStats(sport, variant).played}
          onPlayFree={() => chooseFreeType('standard')}
        />
      </Shell>
    );
  }

  // --- Franchise picker ---
  if (source === 'free' && freeType === 'franchise' && !g.franchiseId) {
    return (
      <Shell {...shellProps}>
        <FranchisePicker data={data} onPick={setFranchiseId} />
      </Shell>
    );
  }

  if (!state) {
    return (
      <Shell {...shellProps}>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">Loading...</div>
      </Shell>
    );
  }

  if (state.done && state.result) {
    if (source === 'free') {
      return (
        <Shell {...shellProps}>
          <ResultCard result={state.result} config={config} mode={mode} picks={state.picks} data={data} onPlayAgain={newGame} />
        </Shell>
      );
    }
    return (
      <Shell {...shellProps}>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">
          Scoring your season...
        </div>
      </Shell>
    );
  }

  const spin = currentSpin(state);
  const picking = phase === 'pick';
  const players = picking ? spinPlayers(state) : [];
  const openCategories = new Set(openSlots(state).map((s) => s.label));
  const filled = state.picks.length;
  const total = config.slots.length;
  const isFranchise = type === 'franchise';
  const isTank = type === 'tank';
  const blind = source === 'daily' && variant === 'blind';

  return (
    <Shell {...shellProps}>
      {(isTank || isFranchise) && (
        <div
          className={`mb-3 rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${
            isTank ? 'bg-sabres-red/10 text-sabres-red' : 'bg-sabres-blue/10 text-sabres-blue'
          }`}
        >
          {isTank
            ? `Tank · build the WORST team, chase 0-${config.games}`
            : `Franchise · best all-time ${franchiseName(data, spin)}`}
        </div>
      )}
      {blind && (
        <div className="mb-3 rounded-xl bg-sabres-navy/5 px-3 py-2 text-center text-xs font-bold uppercase tracking-wide text-sabres-navy">
          🧠 {config.blindLabel} · stats hidden, pick on reputation
        </div>
      )}

      <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
        {phase !== 'pick' ? (
          <>
            <SpinReveal
              data={data}
              spin={spin}
              rolling={phase === 'rolling'}
              previousSpin={state.picks.length > 0 ? state.picks[state.picks.length - 1].spin : null}
              defaultSpin={isFranchise ? null : defaultSpin}
              decadeOnly={isFranchise}
              revealKey={spinKey}
              round={state.round}
              totalRounds={total}
            />

            {phase === 'board' && (
              <>
                <button
                  type="button"
                  onClick={() => setPhase('rolling')}
                  className={`mt-4 w-full rounded-xl py-4 text-lg font-bold uppercase tracking-widest text-white shadow-md transition-all hover:scale-[1.02] active:scale-100 ${
                    isTank ? 'bg-sabres-red hover:brightness-110' : 'bg-sabres-blue hover:bg-sabres-light'
                  }`}
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Spin
                </button>

                {source === 'daily' && (
                  <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
                    {(['classic', 'blind'] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        disabled={state.picks.length > 0}
                        onClick={() => setVariant(v)}
                        className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                          variant === v ? 'bg-white text-sabres-blue shadow-sm' : 'text-gray-400 hover:text-gray-600'
                        }`}
                      >
                        {v === 'classic' ? 'Classic' : `${config.blindLabel} · Blind`}
                      </button>
                    ))}
                  </div>
                )}

                <div className="my-4 border-t border-gray-100" />
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  Your Roster · {filled}/{total}
                </p>
                <RosterList slots={config.slots} picks={state.picks} data={data} fillableSlotIds={new Set()} blind={blind} />
              </>
            )}
          </>
        ) : (
          <>
            <div className="border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                {franchiseLogo(spin.franchise, sport) && (
                  <img src={franchiseLogo(spin.franchise, sport)!} alt="" className="h-7 w-auto shrink-0" />
                )}
                <p className="text-xl font-bold text-sabres-blue" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  <Decade value={spin.decade} /> · {franchiseName(data, spin)}
                </p>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {players.length} available · {isTank ? 'pick a bad one' : 'pick one to assign'} · {filled}/{total} filled
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={!canSkipTeam(state)}
                onClick={() => onSkip({ type: 'SKIP_TEAM' })}
                className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
              >
                Skip Team {state.teamSkipAvail ? '· 1' : '· 0'}
              </button>
              <button
                type="button"
                disabled={!canSkipDecade(state)}
                onClick={() => onSkip({ type: 'SKIP_DECADE' })}
                className="rounded-xl border-2 border-gray-300 py-2 text-xs font-bold uppercase tracking-wide text-gray-700 transition-colors disabled:opacity-40 disabled:line-through enabled:hover:border-sabres-blue enabled:hover:text-sabres-blue"
              >
                Skip Decade {state.decadeSkipAvail ? '· 1' : '· 0'}
              </button>
            </div>

            <div className="mt-3 pb-2">
              <PlayerList
                players={players}
                config={config}
                blind={blind}
                openCategories={openCategories}
                getLegalSlots={(p) => legalSlots(state, p)}
                onAssign={commitAssign}
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-3">
        <HowToPlay goal={`${config.games}-0`} />
      </div>

      <div className="h-20" />

      {undo && (
        <div className="fixed inset-x-0 bottom-4 z-20 flex justify-center px-4">
          <div className="flex w-full max-w-[480px] items-center justify-between rounded-xl bg-sabres-navy px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">Pick added</span>
            <button
              type="button"
              onClick={undoPick}
              className="text-sm font-bold uppercase tracking-wide text-sabres-gold"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Shell({
  sport,
  source,
  freeType,
  onSource,
  onFreeType,
  children,
}: {
  sport: Sport;
  source: Source;
  freeType: FreeType;
  onSource: (s: Source) => void;
  onFreeType: (t: FreeType) => void;
  children: React.ReactNode;
}) {
  const ui = SPORT_UI[sport];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header className="border-b-4 shadow-xl" style={{ background: ui.bg, borderBottomColor: ui.border }}>
        <div className="mx-auto max-w-[480px] px-4 py-3 text-center">
          <Link href={ui.home} className="block transition-opacity hover:opacity-90">
            <p className="text-4xl font-bold tracking-wider text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </p>
          </Link>
          <div className="flex flex-col items-center gap-1 text-sm font-semibold text-white/80">
            <img src={ui.logo} alt={sport.toUpperCase()} className={ui.logoClass} />
            <span>{ui.label}</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[480px] px-3 py-4">
        <div className="mb-2 grid grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm">
          <button
            type="button"
            onClick={() => onSource('daily')}
            className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition-colors ${
              source === 'daily' ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Daily
          </button>
          <button
            type="button"
            onClick={() => onFreeType('standard')}
            className={`rounded-lg py-2 text-center text-xs font-bold uppercase tracking-wide transition-colors ${
              source === 'free' ? 'bg-sabres-blue text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            Free Play
          </button>
        </div>
        {source === 'free' && (
          <div className="mb-3 grid grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-sm">
            {(['standard', 'tank', 'franchise'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onFreeType(t)}
                className={`rounded-lg py-1.5 text-center text-[11px] font-bold uppercase tracking-wide transition-colors ${
                  freeType === t
                    ? t === 'tank'
                      ? 'bg-sabres-red text-white shadow-sm'
                      : 'bg-sabres-blue text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
