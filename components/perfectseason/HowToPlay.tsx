'use client';

import { useState } from 'react';

const STEPS = [
  'Press SPIN to reveal a decade and a franchise for the round.',
  'Pick a player from that pool and tap a slot button to roster them.',
  'Skip the team or the decade once each if you want a different pool.',
  'After six picks, your season plays out. Chase 162-0.',
];

/** One-time How To Play, reopenable. Collapsed by default. */
export default function HowToPlay() {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border-2 border-gray-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        aria-expanded={open}
      >
        <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500">How to play</span>
        <span className="text-gray-400">{open ? '–' : '+'}</span>
      </button>
      {open && (
        <ol className="flex flex-col gap-2 px-4 pb-4">
          {STEPS.map((line, i) => (
            <li key={i} className="flex gap-2 text-sm text-gray-700">
              <span className="font-bold text-sabres-blue">{i + 1}.</span>
              <span>{line}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
