'use client';

import type { Player, SlotDef } from '@/lib/perfectseason/types';

interface RosterStripProps {
  slots: SlotDef[];
  roster: Record<string, Player | null>;
  legalSlotIds: Set<string>;
  selecting: boolean;
  onAssign: (slotId: string) => void;
}

/**
 * The six roster slot chips, pinned under the header and always visible.
 * Legal open chips pulse while a player is selected; tapping one assigns.
 */
export default function RosterStrip({ slots, roster, legalSlotIds, selecting, onAssign }: RosterStripProps) {
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white p-3 shadow-md">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">Your Roster</p>
      <div className="grid grid-cols-6 gap-1.5">
        {slots.map((slot) => {
          const player = roster[slot.id];
          const isLegal = selecting && legalSlotIds.has(slot.id);
          const lastName = player ? player.name.split(' ').slice(-1)[0] : null;
          return (
            <button
              key={slot.id}
              type="button"
              disabled={!isLegal}
              onClick={() => isLegal && onAssign(slot.id)}
              className={[
                'flex min-h-[54px] flex-col items-center justify-center rounded-xl border px-1 py-1.5 transition-all',
                player
                  ? 'border-blue-200 bg-gradient-to-br from-blue-50 to-blue-100'
                  : isLegal
                    ? 'animate-pulse cursor-pointer border-2 border-sabres-gold bg-sabres-gold/10'
                    : 'border-2 border-dashed border-gray-300 bg-white',
              ].join(' ')}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{slot.label}</span>
              {player ? (
                <>
                  <span className="w-full truncate text-center text-[11px] font-bold leading-tight text-gray-800">
                    {lastName}
                  </span>
                  <span className="text-[11px] font-bold text-sabres-blue">{player.score.toFixed(0)}</span>
                </>
              ) : (
                <span className={`text-base font-bold ${isLegal ? 'text-sabres-gold' : 'text-gray-300'}`}>
                  {isLegal ? '+' : '–'}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
