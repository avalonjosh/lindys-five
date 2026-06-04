import Link from 'next/link';

const HOW_TO = [
  'Six spins, six slots. Each spin reveals a decade and a franchise.',
  'Pick a player from that pool and drop them into a legal roster slot.',
  'Skip the team or the decade once each. After six picks, your season plays out.',
];

export default function PerfectSeasonHub() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto flex max-w-[480px] flex-col px-4 pt-12 pb-8">
        <div className="text-center">
          <p className="text-6xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            162-0 <span className="text-sabres-gold">⚾</span>
          </p>
          <p className="mt-1 text-base font-semibold text-gray-600">The Perfect Season</p>
          <p className="mx-auto mt-3 max-w-[340px] text-sm text-gray-500">
            Draft an all-time roster from decade and franchise spins. Can you build a team that goes 162-0?
          </p>
        </div>

        <div className="mt-8 rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400">How to play</p>
          <ol className="mt-2 flex flex-col gap-2">
            {HOW_TO.map((line, i) => (
              <li key={i} className="flex gap-2 text-sm text-gray-700">
                <span className="font-bold text-sabres-blue">{i + 1}.</span>
                <span>{line}</span>
              </li>
            ))}
          </ol>
        </div>

        <Link
          href="/162-0/play"
          className="mt-6 rounded-xl bg-sabres-blue py-4 text-center text-base font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          Play Free
        </Link>

        <p className="mt-3 text-center text-xs text-gray-400">
          The daily puzzle, streaks, and the 82-0 hockey edition are on the way.
        </p>
      </div>
    </div>
  );
}
