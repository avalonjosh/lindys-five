'use client';

import type { SlotDef, Sport } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseColor } from '../ui';

interface RinkProps {
  slots: SlotDef[];
  picks: PickRecord[];
  sport: Sport;
  /** Open slots the selected player can legally fill (glow + clickable). */
  legalSlotIds: Set<string>;
  selecting: boolean;
  onAssign: (slotId: string) => void;
}

// Where each NHL slot sits on the ice (attacking up): forwards across the top,
// defense behind them, goalie in the crease.
const POS: Record<string, { left: string; top: string }> = {
  LW: { left: '20%', top: '20%' },
  C: { left: '50%', top: '13%' },
  RW: { left: '80%', top: '20%' },
  D1: { left: '32%', top: '50%' },
  D2: { left: '68%', top: '50%' },
  G: { left: '50%', top: '82%' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Rink({ slots, picks, sport, legalSlotIds, selecting, onAssign }: RinkProps) {
  const bySlot = new Map(picks.map((p) => [p.slotId, p]));

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-blue-200 bg-gradient-to-b from-blue-50 to-white shadow-inner" style={{ aspectRatio: '4 / 5' }}>
      {/* Ice markings. */}
      <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        {/* goal line + crease near the bottom */}
        <line x1="8" y1="108" x2="92" y2="108" stroke="#C8102E" strokeWidth="0.6" />
        <path d="M 40 108 A 10 10 0 0 0 60 108 Z" fill="#bfdbfe" stroke="#003087" strokeWidth="0.4" />
        {/* blue line */}
        <line x1="0" y1="66" x2="100" y2="66" stroke="#003087" strokeWidth="0.8" />
        {/* center red line */}
        <line x1="0" y1="40" x2="100" y2="40" stroke="#C8102E" strokeWidth="0.8" strokeDasharray="2 1.5" />
        {/* offensive faceoff circles */}
        <circle cx="28" cy="24" r="8" fill="none" stroke="#C8102E" strokeWidth="0.4" />
        <circle cx="72" cy="24" r="8" fill="none" stroke="#C8102E" strokeWidth="0.4" />
      </svg>

      {/* Slots. */}
      {slots.map((slot) => {
        const at = POS[slot.id] ?? { left: '50%', top: '50%' };
        const pick = bySlot.get(slot.id);
        const open = !pick && selecting && legalSlotIds.has(slot.id);
        return (
          <button
            key={slot.id}
            type="button"
            disabled={!open}
            onClick={() => open && onAssign(slot.id)}
            style={{
              left: at.left,
              top: at.top,
              ...(pick ? { background: franchiseColor(pick.spin.franchise, sport) ?? '#003087' } : {}),
            }}
            className={[
              'absolute flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl text-center transition-all',
              pick
                ? 'text-white shadow-md ring-1 ring-black/20'
                : open
                  ? 'animate-pulse cursor-pointer border-2 border-sabres-gold bg-sabres-gold/15 shadow-lg'
                  : 'border-2 border-dashed border-gray-300 bg-white/70',
            ].join(' ')}
          >
            {pick ? (
              <>
                <span className="text-lg font-bold leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {initials(pick.playerName)}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase leading-none text-white/70">{slot.label}</span>
              </>
            ) : (
              <span className={`text-xs font-bold uppercase ${open ? 'text-sabres-navy' : 'text-gray-400'}`}>{slot.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
