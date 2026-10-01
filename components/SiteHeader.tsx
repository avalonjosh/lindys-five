import Link from 'next/link';
import AccountChip from '@/components/AccountChip';

const NAV_LINKS: { href: string; label: string; mobile?: boolean }[] = [
  { href: '/nhl', label: 'NHL', mobile: true },
  { href: '/mlb', label: 'MLB', mobile: true },
  { href: '/nhl/scores', label: 'Scores', mobile: true },
  { href: '/nhl-playoff-odds', label: 'Playoff Odds' },
  { href: '/82-0', label: '82-0' },
  { href: '/162-0', label: '162-0' },
  { href: '/blog', label: 'Blog' },
];

/** The dark site header (home page, account page): wordmark, main links, account chip. */
export default function SiteHeader() {
  return (
    <header className="border-b border-slate-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:h-16 sm:px-6">
        <Link href="/" className="whitespace-nowrap text-3xl leading-none sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Lindy&apos;s Five
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav aria-label="Main" className="flex items-center gap-4 text-sm font-semibold text-slate-200 sm:gap-6 sm:text-[15px]">
            {NAV_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className={`hover:text-amber-400 ${l.mobile ? '' : 'hidden lg:inline'}`}>
                {l.label}
              </Link>
            ))}
          </nav>
          <AccountChip />
        </div>
      </div>
    </header>
  );
}
