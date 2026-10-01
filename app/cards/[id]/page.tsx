import type { Metadata } from 'next';
import Link from 'next/link';
import { getCardById } from '@/lib/perfectseason/cardStore';
import { TIER_LABEL } from '@/lib/perfectseason/cards';
import JerseyCard from '@/components/perfectseason/JerseyCard';

const SITE = 'https://www.lindysfive.com';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const found = await getCardById(id);
  if (!found) return { title: 'Streak card', robots: { index: false, follow: true } };
  const { card, username } = found;
  const slug = card.sport === 'nhl' ? '82-0' : '162-0';
  const title = `${username} earned a ${card.milestone}-day ${slug} streak card`;
  const description = `A ${TIER_LABEL[card.tier]} Lindy's Five card: ${card.player.name}, the best pick from ${username}'s Daily on day ${card.milestone}. Play ${slug} every day to earn your own.`;
  const url = `${SITE}/cards/${id}`;
  const images = [`${SITE}/api/og?type=ps-card&id=${id}`];
  return {
    title,
    description,
    alternates: { canonical: url },
    // A person's card: shareable, but kept out of the index (like shared teams).
    robots: { index: false, follow: true },
    openGraph: { title, description, url, siteName: "Lindy's Five", images },
    twitter: { card: 'summary_large_image', title, description, images },
  };
}

export default async function CardPage({ params }: Props) {
  const { id } = await params;
  const found = await getCardById(id);
  const slug = found?.card.sport === 'mlb' ? '162-0' : '82-0';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <main className="mx-auto flex max-w-[480px] flex-col items-center px-4 py-10 text-center sm:py-14">
        <Link href="/" className="mb-6 text-3xl font-bold tracking-wider text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          Lindy&apos;s Five
        </Link>
        {found ? (
          <>
            <h1 className="mb-1 text-2xl font-bold uppercase tracking-wide text-sabres-navy" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              {found.card.milestone}-Day {slug} Streak Card
            </h1>
            <p className="mb-5 text-sm text-gray-600">
              Earned by <span className="font-semibold text-gray-900">{found.username}</span> for playing the {slug} Daily {found.card.milestone} days in a row.
            </p>
            <JerseyCard card={found.card} width={280} owner={found.username} />
            <p className="mt-2 text-xs text-gray-500">Tap the card to flip it.</p>
          </>
        ) : (
          <>
            <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Card not found</p>
            <h1 className="mt-2 text-2xl font-bold text-sabres-navy">This card link is invalid, or its owner deleted their account.</h1>
          </>
        )}
        <Link
          href={`/${slug}`}
          className="mt-6 rounded-xl bg-sabres-blue px-6 py-3.5 text-base font-bold uppercase tracking-widest text-white shadow-md transition-colors hover:bg-sabres-light"
        >
          Play today&apos;s {slug}
        </Link>
        <p className="mt-3 text-xs text-gray-500">Play the Daily 7 days in a row, signed in, to earn your first card.</p>
      </main>
    </div>
  );
}
