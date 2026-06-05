'use client';

import type { SlotDef, Sport } from '@/lib/perfectseason/types';
import type { PickRecord } from '@/lib/perfectseason/engine';
import { franchiseColor } from '../ui';

interface DiamondProps {
  slots: SlotDef[];
  picks: PickRecord[];
  sport: Sport;
  /** Open slots the selected player can legally fill (glow + clickable). */
  legalSlotIds: Set<string>;
  selecting: boolean;
  onAssign: (slotId: string) => void;
}

// Where each MLB position sits on the field (home plate at the bottom, outfield
// across the top). Percentages of the container.
const POS: Record<string, { left: string; top: string }> = {
  C: { left: '50%', top: '90%' },
  SP: { left: '50%', top: '63%' },
  '1B': { left: '79%', top: '64%' },
  '2B': { left: '63%', top: '40%' },
  SS: { left: '37%', top: '40%' },
  '3B': { left: '21%', top: '64%' },
  LF: { left: '21%', top: '16%' },
  CF: { left: '50%', top: '9%' },
  RF: { left: '79%', top: '16%' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export default function Diamond({ slots, picks, sport, legalSlotIds, selecting, onAssign }: DiamondProps) {
  const bySlot = new Map(picks.map((p) => [p.slotId, p]));

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border-2 border-emerald-200 bg-gradient-to-b from-emerald-200 to-emerald-100 shadow-inner" style={{ aspectRatio: '4 / 5' }}>
      {/* Field markings. */}
      <svg viewBox="0 0 100 125" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        {/* outfield fence arc */}
        <path d="M 6 60 A 58 58 0 0 1 94 60" fill="none" stroke="#ffffff" strokeWidth="0.5" strokeDasharray="2 1.6" />
        {/* foul lines from home plate */}
        <line x1="50" y1="111" x2="98" y2="60" stroke="#ffffff" strokeWidth="0.6" />
        <line x1="50" y1="111" x2="2" y2="60" stroke="#ffffff" strokeWidth="0.6" />
        {/* infield dirt diamond */}
        <polygon points="50,112 80,82 50,52 20,82" fill="#e8c9a0" stroke="#ffffff" strokeWidth="0.5" />
        {/* pitcher's mound */}
        <circle cx="50" cy="80" r="4" fill="#e8c9a0" stroke="#ffffff" strokeWidth="0.3" />
        {/* home plate */}
        <rect x="48.6" y="109.5" width="2.8" height="2.8" fill="#ffffff" />
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
              'absolute flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-xl text-center transition-all',
              pick
                ? 'text-white shadow-md ring-1 ring-black/20'
                : open
                  ? 'animate-pulse cursor-pointer border-2 border-sabres-gold bg-sabres-gold/20 shadow-lg'
                  : 'border-2 border-dashed border-gray-400/70 bg-white/70',
            ].join(' ')}
          >
            {pick ? (
              <>
                <span className="text-base font-bold leading-none" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
                  {initials(pick.playerName)}
                </span>
                <span className="mt-0.5 text-[9px] font-bold uppercase leading-none text-white/70">{slot.label}</span>
              </>
            ) : (
              <span className={`text-[11px] font-bold uppercase ${open ? 'text-sabres-navy' : 'text-gray-500'}`}>{slot.label}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
