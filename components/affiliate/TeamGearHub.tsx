import Link from 'next/link';
import { ShoppingBag } from 'lucide-react';
import { generateAmazonSearchLink, generateFanaticsLink } from '@/lib/utils/affiliateLinks';
import AffiliateLink from './AffiliateLink';

export interface HubTeam {
  sport: 'nhl' | 'mlb';
  slug: string;
  city: string;
  name: string;
  primaryColor: string;
  accentColor?: string;
}

const CATEGORIES = [
  { key: 'jerseys', label: 'Jerseys', blurb: 'Home, away, and throwback jerseys' },
  { key: 'hats', label: 'Hats & Caps', blurb: 'Fitted, snapback, and knit caps' },
  { key: 'apparel', label: 'T-Shirts & Hoodies', blurb: 'Tees, hoodies, and crewnecks' },
  { key: 'collectibles', label: 'Collectibles & Decor', blurb: 'Pucks, signs, and home decor' },
];

const BASE = 'https://www.lindysfive.com';

/** Server-rendered, indexable per-team gear hub. Compliant on-site destination
 *  for Amazon (Amazon links can't go in email) plus Fanatics, with real content. */
export default function TeamGearHub({ team }: { team: HubTeam }) {
  const full = `${team.city} ${team.name}`;
  const league = team.sport === 'nhl' ? 'NHL' : 'MLB';
  const teamPath = `/${team.sport}/${team.slug}`;
  const accent = team.accentColor || '#FFB81C';

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: league, item: `${BASE}/${team.sport}` },
      { '@type': 'ListItem', position: 3, name: full, item: `${BASE}${teamPath}` },
      { '@type': 'ListItem', position: 4, name: 'Gear', item: `${BASE}${teamPath}/gear` },
    ],
  };
  const itemList = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${full} Fan Gear`,
    itemListElement: CATEGORIES.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `${full} ${c.label}` })),
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemList) }} />

      <header className="border-b-4 shadow-lg" style={{ background: team.primaryColor, borderBottomColor: accent }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-white/80">
            <ShoppingBag className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Fan Gear</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {full} Gear &amp; Jerseys
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Shop officially licensed {full} {league} jerseys, hats, and apparel — curated from Amazon and Fanatics.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-4 text-sm text-gray-500">
          <Link href={`/${team.sport}`} className="hover:text-gray-700">{league}</Link>
          <span className="mx-2">/</span>
          <Link href={teamPath} className="hover:text-gray-700">{team.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Gear</span>
        </nav>

        <div className="grid gap-3 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <div key={c.key} className="rounded-2xl border-2 border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{full} {c.label}</h2>
              <p className="mb-3 text-xs text-gray-500">{c.blurb}</p>
              <div className="flex gap-2">
                <AffiliateLink
                  href={generateAmazonSearchLink(`${full} ${league} ${c.label}`)}
                  track="gear" trackLabel={`${team.slug}-amazon-${c.key}`}
                  className="flex-1 rounded-lg px-3 py-2 text-center text-xs font-bold text-white transition-opacity hover:opacity-90"
                  style={{ background: team.primaryColor }}
                >
                  Amazon
                </AffiliateLink>
                <AffiliateLink
                  href={generateFanaticsLink(team.city, team.name, c.label)}
                  track="gear" trackLabel={`${team.slug}-fanatics-${c.key}`}
                  className="flex-1 rounded-lg border-2 px-3 py-2 text-center text-xs font-bold transition-colors hover:bg-gray-50"
                  style={{ borderColor: team.primaryColor, color: team.primaryColor }}
                >
                  Fanatics
                </AffiliateLink>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href={teamPath} className="font-semibold text-sabres-blue hover:underline">← {team.name} playoff odds</Link>
          <Link href={`${teamPath}/tickets`} className="font-semibold text-sabres-blue hover:underline">{team.name} tickets →</Link>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          As an Amazon Associate and affiliate partner, Lindy&apos;s Five may earn a commission from qualifying
          purchases made through these links, at no extra cost to you.
        </p>
      </main>
    </div>
  );
}
