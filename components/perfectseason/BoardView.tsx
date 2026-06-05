'use client';

import { useEffect, useState, type ComponentType } from 'react';
import Link from 'next/link';
import { canSkipDecade, canSkipTeam, currentSpin, legalSlots, spinPlayers, type PickRecord } from '@/lib/perfectseason/engine';
import { getStats, getStreak } from '@/lib/perfectseason/storage';
import type { SlotDef, Sport } from '@/lib/perfectseason/types';
import type { FreeType, GameProps, Source } from './usePerfectSeasonGame';
import { usePerfectSeasonGame } from './usePerfectSeasonGame';
import { SPORT_UI } from './sportUi';
import SpinReveal from './SpinReveal';
import BoardDailyResult from './board/BoardDailyResult';
import FranchisePicker from './FranchisePicker';
import HowToPlaySheet, { HelpButton } from './board/HowToPlaySheet';
import { franchiseColor, franchiseLogo, franchiseName, shortDecade } from './ui';
import RosterStrip from './board/RosterStrip';
import PositionSheet from './board/PositionSheet';
import BoardPlayerList from './board/BoardPlayerList';
import BoardResult from './board/BoardResult';

/** The field-diagram component (rink for NHL, diamond for MLB). */
export type DiagramProps = {
  slots: SlotDef[];
  picks: PickRecord[];
  sport: Sport;
  legalSlotIds: Set<string>;
  selecting: boolean;
  onAssign: (slotId: string) => void;
};

export interface BoardViewProps extends GameProps {
  /** The desktop field diagram (Rink / Diamond). */
  Diagram: ComponentType<DiagramProps>;
  /** Where players are placed, for the How-To copy: "ice" / "field". */
  surface: string;
}

/** 82-0.com-style board, shared by both sports: two columns on desktop
 *  (controls/list + field diagram), stacked on mobile (list + bottom position
 *  circles + a Choose Position sheet). */
export default function BoardView(props: BoardViewProps) {
  const { sport, data, config, defaultSpin, Diagram, surface } = props;
  const g = usePerfectSeasonGame(props);
  const {
    source,
    freeType,
    franchiseId,
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

  const [selectedId, setSelectedId] = useState<string | null>(null);
  useEffect(() => {
    if (phase !== 'pick') setSelectedId(null);
  }, [phase]);

  // How To Play overlay; the "?" pulses once until the player first opens it.
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpSeen, setHelpSeen] = useState(true); // assume seen on SSR to avoid a pulse flash
  useEffect(() => {
    try {
      setHelpSeen(localStorage.getItem('ps:nhl:help-seen') === '1');
    } catch {
      /* storage unavailable */
    }
  }, []);
  const openHelp = () => {
    setHelpOpen(true);
    if (!helpSeen) {
      setHelpSeen(true);
      try {
        localStorage.setItem('ps:nhl:help-seen', '1');
      } catch {
        /* storage unavailable */
      }
    }
  };

  // Hide the Daily/Free + mode toggles once a game is underway (spun or any picks
  // down) so they can't switch mid-draft; they return on the opening board + results.
  const inProgress = !!state && !state.done && (state.picks.length > 0 || phase !== 'board');
  const shellProps = { sport, source, freeType, inProgress, onSource: setSource, onFreeType: chooseFreeType };

  if (source === 'daily' && record) {
    return (
      <Shell {...shellProps}>
        <div className="mx-auto max-w-[480px]">
          <BoardDailyResult
            record={record}
            config={config}
            variant={variant}
            streak={getStreak(sport, variant)}
            played={getStats(sport, variant).played}
            onPlayFree={() => chooseFreeType('standard')}
          />
        </div>
      </Shell>
    );
  }

  if (source === 'free' && freeType === 'franchise' && !franchiseId) {
    return (
      <Shell {...shellProps}>
        <div className="mx-auto max-w-[480px]">
          <FranchisePicker data={data} onPick={setFranchiseId} />
        </div>
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
          <div className="mx-auto max-w-[560px]">
            <BoardResult result={state.result} config={config} mode={mode} picks={state.picks} data={data} onPlayAgain={newGame} />
          </div>
        </Shell>
      );
    }
    return (
      <Shell {...shellProps}>
        <div className="py-20 text-center text-sm font-semibold uppercase tracking-widest text-gray-400">Scoring your season...</div>
      </Shell>
    );
  }

  const spin = currentSpin(state);
  const picking = phase === 'pick';
  const players = picking ? spinPlayers(state) : [];
  const filled = state.picks.length;
  const total = config.slots.length;
  const isFranchise = type === 'franchise';
  const isTank = type === 'tank';
  const blind = variant === 'blind';

  const selectedPlayer = selectedId ? players.find((p) => p.id === selectedId) ?? null : null;
  const selectedLegal = selectedPlayer ? legalSlots(state, selectedPlayer) : [];
  const legalSlotIds = new Set(selectedLegal.map((s) => s.id));

  const assign = (slotId: string) => {
    if (!selectedId) return;
    commitAssign(selectedId, slotId);
    setSelectedId(null);
  };

  const controlsBar = picking ? (
    <div className="flex items-center justify-between gap-2">
      <div className="flex shrink-0 items-center gap-1.5">
        <span
          className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm"
          style={{ background: franchiseColor(spin.franchise, sport) ?? '#003087' }}
        >
          {/* NHL has a white logo variant for the team-color pill; MLB logos are
              single-color and would clash on the team background, so show the abbrev only. */}
          {sport === 'nhl' && franchiseLogo(spin.franchise, sport) && (
            <img src={franchiseLogo(spin.franchise, sport)!} alt="" className="h-4 w-auto shrink-0" />
          )}
          {spin.franchise}
        </span>
        <span className="rounded-full bg-sabres-gold/20 px-2.5 py-1 text-xs font-bold text-sabres-navy">
          {`${shortDecade(spin.decade).replace(/s$/i, '')}'S`}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <RerollAction label="Team" left={state.teamSkipAvail ? 1 : 0} disabled={!canSkipTeam(state)} onClick={() => onSkip({ type: 'SKIP_TEAM' })} />
        <RerollAction label="Decade" left={state.decadeSkipAvail ? 1 : 0} disabled={!canSkipDecade(state)} onClick={() => onSkip({ type: 'SKIP_DECADE' })} />
      </div>
    </div>
  ) : undefined;

  return (
    <Shell {...shellProps} roundLabel={`Round ${Math.min(state.round + 1, total)}/${total}`} subBar={controlsBar}>
      {(isTank || isFranchise || blind) && (
        <div
          className={`mx-auto mb-3 max-w-[820px] rounded-xl px-3 py-2 text-center text-xs font-bold uppercase tracking-wide ${
            isTank ? 'bg-sabres-red/10 text-sabres-red' : blind ? 'bg-sabres-navy/5 text-sabres-navy' : 'bg-sabres-blue/10 text-sabres-blue'
          }`}
        >
          {isTank
            ? `Tank · build the WORST team, chase 0-${config.games}`
            : blind
              ? `🧠 ${config.blindLabel} · stats hidden, pick on reputation`
              : `Franchise · best all-time ${franchiseName(data, spin)}`}
        </div>
      )}

      <div className="mx-auto grid max-w-[820px] gap-4 md:grid-cols-2">
        {/* LEFT: spin controls / player list */}
        <div className="min-w-0 pb-28 md:pb-0">
          {phase !== 'pick' ? (
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
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
                tileVariant="nhl"
              />
              {phase === 'board' && (
                <>
                  <button
                    type="button"
                    onClick={() => setPhase('rolling')}
                    className={`mt-4 w-full rounded-xl py-4 text-xl font-bold uppercase tracking-widest text-white shadow-md transition-all hover:scale-[1.02] active:scale-100 ${
                      isTank ? 'bg-sabres-red hover:brightness-110' : 'bg-sabres-blue hover:bg-sabres-light'
                    }`}
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    Spin
                  </button>
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
                        {v === 'classic' ? 'Classic' : config.blindLabel}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-md">
              <p className="text-xs text-gray-500">
                {players.length} available · {selectedPlayer ? 'choose a spot' : isTank ? 'pick a bad one' : 'pick one'} · {filled}/{total} filled
              </p>
              <div className="mt-3">
                <BoardPlayerList
                  players={players}
                  config={config}
                  blind={blind}
                  selectedId={selectedId}
                  getLegalSlots={(p) => legalSlots(state, p)}
                  onSelect={(p) => setSelectedId(p.id)}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: field diagram (desktop only) */}
        <div className="hidden min-w-0 md:block">
          <div className="sticky top-4">
            <Diagram
              slots={config.slots}
              picks={state.picks}
              sport={sport}
              legalSlotIds={legalSlotIds}
              selecting={!!selectedPlayer}
              onAssign={assign}
            />
            <p className="mt-2 text-center text-xs font-semibold text-gray-500">
              {selectedPlayer ? `Placing ${selectedPlayer.name} — click a spot` : `${filled}/${total} positions filled`}
            </p>
            {!inProgress && (
              <div className="mt-2 flex items-center justify-end">
                <HelpButton onClick={openHelp} pulse={!helpSeen} />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE: roster circles pinned at the bottom */}
      <div className="fixed inset-x-0 bottom-0 z-10 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur md:hidden">
        {!inProgress && (
          <div className="absolute -top-12 right-3">
            <HelpButton onClick={openHelp} pulse={!helpSeen} />
          </div>
        )}
        <div className="mx-auto max-w-[480px]">
          <RosterStrip slots={config.slots} picks={state.picks} sport={sport} />
        </div>
      </div>

      {/* MOBILE: choose-position sheet */}
      {selectedPlayer && (
        <div className="md:hidden">
          <PositionSheet
            player={selectedPlayer}
            config={config}
            picks={state.picks}
            legal={selectedLegal}
            onAssign={assign}
            onClose={() => setSelectedId(null)}
          />
        </div>
      )}

      <HowToPlaySheet open={helpOpen} onClose={() => setHelpOpen(false)} goal={`${config.games}-0`} surface={surface} slotCount={config.slots.length} />

      {undo && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4 md:bottom-4">
          <div className="flex w-full max-w-[480px] items-center justify-between rounded-xl bg-sabres-navy px-4 py-3 text-white shadow-xl">
            <span className="text-sm font-semibold">Pick added</span>
            <button type="button" onClick={undoPick} className="text-sm font-bold uppercase tracking-wide text-sabres-gold">
              Undo
            </button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/** Compact 82-0.com-style reroll action ("↻ Team · 1"); struck through when spent. */
function RerollAction({ label, left, disabled, onClick }: { label: string; left: number; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-gray-200 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-sabres-blue transition-colors disabled:border-gray-100 disabled:text-gray-300 enabled:hover:bg-sabres-blue/10"
    >
      <span aria-hidden>↻</span>
      {label} · {left}
    </button>
  );
}

function Shell({
  sport,
  source,
  freeType,
  inProgress,
  roundLabel,
  subBar,
  onSource,
  onFreeType,
  children,
}: {
  sport: GameProps['sport'];
  source: Source;
  freeType: FreeType;
  inProgress: boolean;
  roundLabel?: string;
  subBar?: React.ReactNode;
  onSource: (s: Source) => void;
  onFreeType: (t: FreeType) => void;
  children: React.ReactNode;
}) {
  const ui = SPORT_UI[sport];
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Compact 82-0.com-style top bar: brand + 82-0 badge left, round right. */}
      <header className="border-b-4 shadow-lg" style={{ background: ui.bg, borderBottomColor: ui.border }}>
        <div className="mx-auto flex max-w-[860px] items-center justify-between gap-3 px-4 py-2.5">
          <Link href={ui.home} className="flex min-w-0 items-center gap-2.5 transition-opacity hover:opacity-90">
            <span className="text-2xl font-bold tracking-wider text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Lindy&apos;s Five
            </span>
            <span
              className="shrink-0 rounded-md bg-sabres-gold px-2 py-0.5 text-sm font-bold tracking-wide text-sabres-navy"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {ui.label}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-2.5">
            {roundLabel && <span className="text-xs font-bold uppercase tracking-wide text-white/80">{roundLabel}</span>}
            <img src={ui.logo} alt={sport.toUpperCase()} className="h-6 w-auto opacity-90" />
          </div>
        </div>
      </header>
      {/* Secondary band (team + decade + reroll), stacked under the header like 82-0.com. */}
      {subBar && (
        <div className="border-b border-gray-200 bg-white shadow-sm">
          <div className="mx-auto max-w-[860px] px-4 py-2">{subBar}</div>
        </div>
      )}
      <main className="mx-auto max-w-[860px] px-3 py-4">
        {!inProgress && (
          <div className="mx-auto mb-2 grid max-w-[480px] grid-cols-2 gap-1 rounded-xl bg-white p-1 shadow-sm">
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
        )}
        {!inProgress && source === 'free' && (
          <div className="mx-auto mb-3 grid max-w-[480px] grid-cols-3 gap-1 rounded-xl bg-white p-1 shadow-sm">
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
