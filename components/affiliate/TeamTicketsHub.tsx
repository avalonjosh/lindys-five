import Link from 'next/link';
import { Ticket } from 'lucide-react';
import { generateTeamTicketsLink } from '@/lib/utils/affiliateLinks';
import AffiliateLink from './AffiliateLink';
import type { HubTeam } from './TeamGearHub';

const BASE = 'https://www.lindysfive.com';

/** Server-rendered, indexable per-team tickets hub (StubHub via Partnerize). */
export default function TeamTicketsHub({ team, stubhubId }: { team: HubTeam; stubhubId: number }) {
  const full = `${team.city} ${team.name}`;
  const league = team.sport === 'nhl' ? 'NHL' : 'MLB';
  const teamPath = `/${team.sport}/${team.slug}`;
  const accent = team.accentColor || '#FFB81C';
  const ticketsUrl = generateTeamTicketsLink(team.slug, team.city, stubhubId);

  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: BASE },
      { '@type': 'ListItem', position: 2, name: league, item: `${BASE}/${team.sport}` },
      { '@type': 'ListItem', position: 3, name: full, item: `${BASE}${teamPath}` },
      { '@type': 'ListItem', position: 4, name: 'Tickets', item: `${BASE}${teamPath}/tickets` },
    ],
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb) }} />

      <header className="border-b-4 shadow-lg" style={{ background: team.primaryColor, borderBottomColor: accent }}>
        <div className="mx-auto max-w-3xl px-4 py-8 text-center">
          <div className="mb-2 flex items-center justify-center gap-2 text-white/80">
            <Ticket className="h-5 w-5" />
            <span className="text-xs font-bold uppercase tracking-widest">Tickets</span>
          </div>
          <h1 className="text-3xl font-bold text-white sm:text-4xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {full} Tickets
          </h1>
          <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
            Find {full} {league} tickets for every home and away game on StubHub — verified resale with a buyer guarantee.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <nav className="mb-4 text-sm text-gray-500">
          <Link href={`/${team.sport}`} className="hover:text-gray-700">{league}</Link>
          <span className="mx-2">/</span>
          <Link href={teamPath} className="hover:text-gray-700">{team.name}</Link>
          <span className="mx-2">/</span>
          <span className="text-gray-700">Tickets</span>
        </nav>

        <div className="rounded-2xl border-2 border-gray-200 bg-white p-6 text-center shadow-sm">
          <h2 className="text-xl font-bold text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>Browse {full} tickets</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">
            Full season schedule, interactive seat maps, and live pricing. Prices rise as game day nears, so the best
            deals are usually earlier in the week.
          </p>
          <AffiliateLink
            href={ticketsUrl}
            track="tickets" trackLabel={`${team.slug}-hub`}
            className="mt-4 inline-block rounded-xl px-6 py-3.5 text-base font-bold uppercase tracking-wide text-white shadow-md transition-opacity hover:opacity-90"
            style={{ background: team.primaryColor }}
          >
            See tickets on StubHub
          </AffiliateLink>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm">
          <Link href={teamPath} className="font-semibold text-sabres-blue hover:underline">← {team.name} playoff odds</Link>
          <Link href={`/${team.sport}/scores`} className="font-semibold text-sabres-blue hover:underline">{league} scores →</Link>
          <Link href={`${teamPath}/gear`} className="font-semibold text-sabres-blue hover:underline">{team.name} gear →</Link>
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-gray-400">
          Lindy&apos;s Five may earn a commission from ticket purchases made through our affiliate links, at no extra
          cost to you.
        </p>
      </main>
    </div>
  );
}
