'use client';

import type { SlotDef, Sport } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseColor } from '../ui';

interface RosterStripProps {
  slots: SlotDef[];
  picks: PickRecord[];
  sport: Sport;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The roster as a row of position circles (mobile, pinned under the board).
 *  Chips shrink when there are many slots (e.g. MLB's 9) so the row still fits. */
export default function RosterStrip({ slots, picks, sport }: RosterStripProps) {
  const bySlot = new Map(picks.map((p) => [p.slotId, p]));
  const big = slots.length <= 6;
  const circle = big ? 'h-11 w-11' : 'h-9 w-9';
  const initSize = big ? 'text-[13px]' : 'text-[11px]';
  const emptySize = big ? 'text-[10px]' : 'text-[9px]';

  return (
    <div className="flex items-start justify-between gap-0.5">
      {slots.map((slot) => {
        const pick = bySlot.get(slot.id);
        return (
          <div key={slot.id} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className={[
                'flex items-center justify-center rounded-full',
                circle,
                pick ? 'text-white shadow-md ring-1 ring-black/10' : 'border-2 border-dashed border-gray-300 bg-white',
              ].join(' ')}
              style={pick ? { background: franchiseColor(pick.spin.franchise, sport) ?? '#003087' } : undefined}
            >
              {pick ? (
                <span className={`${initSize} font-bold leading-none`} style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {initials(pick.playerName)}
                </span>
              ) : (
                <span className={`${emptySize} font-bold text-gray-400`}>{slot.label}</span>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase text-gray-400">{slot.label}</span>
          </div>
        );
      })}
    </div>
  );
}
