'use client';

import type { GameData, SlotDef } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseLogo, franchiseName } from './ui';
import Decade from './Decade';

interface RosterListProps {
  slots: SlotDef[];
  picks: PickRecord[];
  data: GameData;
  /** Slot ids that the current spin can legally fill, for a subtle highlight. */
  fillableSlotIds: Set<string>;
  /** Blind mode hides the rostered player's score. */
  blind?: boolean;
}

/**
 * The roster slots as a vertical list. Display only: assignment happens from the
 * player rows. In blind mode the per-player score is hidden.
 */
export default function RosterList({ slots, picks, data, fillableSlotIds, blind = false }: RosterListProps) {
  const bySlot = new Map(picks.map((p) => [p.slotId, p]));
  return (
    <ul className="flex flex-col gap-1.5">
      {slots.map((slot) => {
        const pick = bySlot.get(slot.id);
        const fillable = !pick && fillableSlotIds.has(slot.id);
        return (
          <li
            key={slot.id}
            className={[
              'flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition-colors',
              pick
                ? 'bg-gradient-to-br from-blue-50 to-blue-100'
                : fillable
                  ? 'bg-sabres-gold/10 ring-1 ring-sabres-gold/40'
                  : 'bg-gray-50',
            ].join(' ')}
          >
            <span className="flex h-7 w-9 shrink-0 items-center justify-center rounded-md bg-sabres-blue text-[11px] font-bold text-white">
              {slot.label}
            </span>
            {pick ? (
              <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-bold text-gray-900">{pick.playerName}</div>
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    {franchiseLogo(pick.spin.franchise) && (
                      <img src={franchiseLogo(pick.spin.franchise)!} alt="" className="h-4 w-auto shrink-0" />
                    )}
                    <span className="truncate">
                      <Decade value={pick.spin.decade} /> {franchiseName(data, pick.spin)}
                    </span>
                  </div>
                </div>
                {!blind && (
                  <span
                    className="shrink-0 rounded-lg bg-gradient-to-br from-sabres-navy to-sabres-blue px-2 py-0.5 text-sm font-bold text-white"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {pick.score.toFixed(0)}
                  </span>
                )}
              </div>
            ) : (
              <span className={`text-sm italic ${fillable ? 'font-semibold text-sabres-navy not-italic' : 'text-gray-400'}`}>
                {fillable ? 'Open for this spin' : 'Empty slot'}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
