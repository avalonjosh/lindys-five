'use client';

import type { SlotDef, Sport } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseColor } from '../ui';

interface RosterCirclesProps {
  slots: SlotDef[];
  picks: PickRecord[];
  sport: Sport;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}

/** The roster as a row of position circles (mobile, pinned under the board). */
export default function RosterCircles({ slots, picks, sport }: RosterCirclesProps) {
  const bySlot = new Map(picks.map((p) => [p.slotId, p]));
  return (
    <div className="flex items-start justify-between gap-1">
      {slots.map((slot) => {
        const pick = bySlot.get(slot.id);
        return (
          <div key={slot.id} className="flex flex-1 flex-col items-center gap-0.5">
            <div
              className={[
                'flex h-11 w-11 items-center justify-center rounded-full',
                pick ? 'text-white shadow-md ring-1 ring-black/10' : 'border-2 border-dashed border-gray-300 bg-white',
              ].join(' ')}
              style={pick ? { background: franchiseColor(pick.spin.franchise, sport) ?? '#003087' } : undefined}
            >
              {pick ? (
                <span className="text-[13px] font-bold leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {initials(pick.playerName)}
                </span>
              ) : (
                <span className="text-[10px] font-bold text-gray-400">{slot.label}</span>
              )}
            </div>
            <span className="text-[9px] font-bold uppercase text-gray-400">{slot.label}</span>
          </div>
        );
      })}
    </div>
  );
}
