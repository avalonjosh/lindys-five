'use client';

/** Subtle gold "?" trigger; pulses once until the player has opened it. */
export function HelpButton({ onClick, pulse = false }: { onClick: () => void; pulse?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="How to play"
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-gray-300 bg-white text-sm font-bold text-sabres-navy shadow-md transition-colors hover:bg-gray-50 ${
        pulse ? 'animate-pulse' : ''
      }`}
    >
      ?
    </button>
  );
}

const STEPS = (goal: string): string[] => [
  'Press SPIN to reveal a decade and a franchise for the round.',
  'Pick a player from that pool, then place them at a position on the ice.',
  'Skip the team or the decade once each if you want a different pool.',
  `After six picks, your season plays out. Chase ${goal}.`,
];

/** How To Play overlay: a bottom sheet on mobile, a centered modal on desktop. */
export default function HowToPlaySheet({ open, onClose, goal }: { open: boolean; onClose: () => void; goal: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="animate-sheet-up relative w-full max-w-[440px] rounded-t-2xl bg-white p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-2xl md:animate-none md:rounded-2xl md:pb-5">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300 md:hidden" aria-hidden />
        <div className="mb-4 flex items-center justify-between">
          <p className="text-2xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            How to play
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center text-2xl leading-none text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        <ol className="flex flex-col gap-3">
          {STEPS(goal).map((line, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sabres-blue text-xs font-bold text-white">
                {i + 1}
              </span>
              <span className="pt-0.5">{line}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
