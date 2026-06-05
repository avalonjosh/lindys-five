'use client';

import type { Player, SlotDef, SportConfig } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';

interface PositionSheetProps {
  player: Player;
  config: SportConfig;
  picks: PickRecord[];
  /** The player's open, finishable slots (drives the assignable positions). */
  legal: SlotDef[];
  onAssign: (slotId: string) => void;
  onClose: () => void;
}

type State = 'active' | 'filled' | 'na';

/**
 * Mobile bottom sheet to place a selected player. Each position reads as
 * assignable, already filled, or not eligible (N/A), mirroring 82-0.com.
 */
export default function PositionSheet({ player, config, picks, legal, onAssign, onClose }: PositionSheetProps) {
  const filledSlots = new Set(picks.map((p) => p.slotId));

  // Distinct position labels, with one assign target per label.
  const labels: string[] = [];
  for (const s of config.slots) if (!labels.includes(s.label)) labels.push(s.label);

  const cells = labels.map((label) => {
    const slotsOfLabel = config.slots.filter((s) => s.label === label);
    const eligible = slotsOfLabel[0].accepts.some((a) => player.pos.includes(a));
    const legalSlot = legal.find((s) => s.label === label);
    const allFilled = slotsOfLabel.every((s) => filledSlots.has(s.id));
    let state: State = 'na';
    if (legalSlot) state = 'active';
    else if (eligible && allFilled) state = 'filled';
    return { label, slotId: legalSlot?.id ?? null, state };
  });

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/30" />
      <div className="animate-sheet-up relative w-full max-w-[480px] rounded-t-2xl bg-white p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" aria-hidden />
        <div className="mb-3 flex items-center justify-between">
          <p className="text-base font-bold text-gray-900">{player.name} — Choose Position</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 items-center justify-center text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <div className="grid grid-cols-5 gap-2">
          {cells.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={c.state !== 'active'}
              onClick={() => c.slotId && onAssign(c.slotId)}
              className={[
                'flex min-h-[64px] flex-col items-center justify-center rounded-xl border-2 px-1 text-center transition-colors',
                c.state === 'active'
                  ? 'cursor-pointer border-sabres-blue bg-sabres-blue/10 text-sabres-blue hover:bg-sabres-blue hover:text-white'
                  : 'cursor-not-allowed border-gray-200 bg-gray-50 text-gray-300',
              ].join(' ')}
            >
              <span className="text-base font-bold uppercase">{c.label}</span>
              <span className="text-[9px] font-semibold uppercase tracking-wide">
                {c.state === 'active' ? '' : c.state === 'filled' ? 'Filled' : 'N/A'}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
