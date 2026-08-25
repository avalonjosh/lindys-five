import type { Metadata } from 'next';
import Link from 'next/link';
import SiteFooter from '@/components/SiteFooter';

export const metadata: Metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: true },
};

export default function NotFound() {
  return (
    <>
      <main className="min-h-[60vh] bg-gradient-to-b from-sabres-navy to-sabres-blue px-4 py-20 text-center text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-white/60">404</p>
        <h1 className="mt-2 text-4xl font-bold sm:text-5xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
          That page went to overtime and never came back
        </h1>
        <p className="mx-auto mt-4 max-w-md text-white/80">
          The page you asked for doesn&apos;t exist or has moved. Try one of these instead.
        </p>
        <div className="mx-auto mt-8 flex max-w-lg flex-wrap justify-center gap-3 text-sm font-semibold">
          <Link href="/" className="rounded-full bg-white px-4 py-2 text-sabres-navy hover:bg-gray-100">Home</Link>
          <Link href="/nhl-playoff-odds" className="rounded-full border border-white/40 px-4 py-2 hover:bg-white/10">NHL Playoff Odds</Link>
          <Link href="/mlb/playoff-odds" className="rounded-full border border-white/40 px-4 py-2 hover:bg-white/10">MLB Playoff Odds</Link>
          <Link href="/nhl/scores" className="rounded-full border border-white/40 px-4 py-2 hover:bg-white/10">NHL Scores</Link>
          <Link href="/blog" className="rounded-full border border-white/40 px-4 py-2 hover:bg-white/10">Blog</Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
