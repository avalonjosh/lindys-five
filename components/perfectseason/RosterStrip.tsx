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
              'flex flex-col items-center justify-center rounded-lg border-2 px-1 py-1.5 min-h-[52px] transition-all',
              player
                ? 'border-sabres-blue bg-sabres-blue/5'
                : isLegal
                  ? 'border-sabres-gold bg-sabres-gold/10 animate-pulse cursor-pointer'
                  : 'border-dashed border-gray-300 bg-white',
            ].join(' ')}
          >
            <span className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{slot.label}</span>
            {player ? (
              <>
                <span className="text-[11px] font-bold leading-tight text-gray-800 truncate w-full text-center">
                  {lastName}
                </span>
                <span className="text-[10px] font-semibold text-sabres-blue">{player.score.toFixed(0)}</span>
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
  );
}
