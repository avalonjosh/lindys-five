import type { Metadata } from 'next';
import Link from 'next/link';
import MLBTeamNav from '@/components/mlb/MLBTeamNav';

export const metadata: Metadata = {
  title: 'MLB Playoff Odds — Coming Soon',
  description: 'MLB playoff odds and projections for all 30 teams. Coming soon.',
};

export default function MLBPlayoffOddsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <header
        className="shadow-xl border-b-4"
        style={{ background: '#002D72', borderBottomColor: '#041E42' }}
      >
        <div className="max-w-7xl mx-auto px-4 py-8 md:py-12 text-center relative">
          <div className="absolute top-4 left-4">
            <MLBTeamNav
              currentTeamId=""
              teamColors={{ primary: '#002D72', secondary: '#E31937', accent: '#FFFFFF' }}
            />
          </div>
          <Link href="/" className="inline-block mb-2">
            <p
              className="text-xl md:text-2xl font-bold text-white/70 hover:text-white transition-colors"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Lindy&apos;s Five
            </p>
          </Link>
          <h1
            className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            MLB Playoff Odds
          </h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-5xl mb-6">&#9918;</p>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Coming Soon</h2>
        <p className="text-gray-600 mb-8">
          MLB playoff odds and projections for all 30 teams are on the way.
        </p>
        <Link
          href="/mlb/scores"
          className="inline-block bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          View MLB Scores
        </Link>
      </main>
    </div>
  );
}
