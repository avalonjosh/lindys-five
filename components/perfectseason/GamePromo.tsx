import Link from 'next/link';

/** Light-theme "Can you go 82-0?/162-0?" promo card for the tracker side of the
 *  site (playoff-odds + team pages), linking to the matching Perfect Season game. */
export default function GamePromo({ sport, className }: { sport: 'nhl' | 'mlb'; className?: string }) {
  const slug = sport === 'mlb' ? '162-0' : '82-0';
  const league = sport === 'mlb' ? 'MLB' : 'NHL';
  return (
    <div className={`rounded-2xl border-2 border-sabres-blue/20 bg-white p-5 text-center shadow-sm ${className ?? ''}`}>
      <p className="text-xs font-bold uppercase tracking-widest text-sabres-blue">Lindy&apos;s Five Game</p>
      <h3 className="mt-1 text-xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Can you go {slug}?</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">Draft an all-time {league} roster from decade &amp; franchise spins and chase a perfect season — a free daily game.</p>
      <Link href={`/${slug}`} className="mt-3 inline-block rounded-xl bg-sabres-blue px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition-colors hover:bg-sabres-light">
        Play {slug}
      </Link>
    </div>
  );
}
