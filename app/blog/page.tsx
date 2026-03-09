import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPublishedPosts } from '@/lib/kv';
import type { BlogPost, PostType } from '@/lib/types';
import BlogNav from '@/components/blog/BlogNav';
import PostCard from '@/components/blog/PostCard';
import HeroCard from '@/components/blog/HeroCard';
import BlogSection from '@/components/blog/BlogSection';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Buffalo sports coverage - Sabres game recaps, Bills analysis, and more from Lindy\'s Five.',
  openGraph: {
    title: 'Blog | Lindy\'s Five',
    description: 'Buffalo sports coverage - Sabres game recaps, Bills analysis, and more.',
    type: 'website',
    url: 'https://lindysfive.com/blog',
    siteName: 'Lindy\'s Five',
  },
  twitter: {
    card: 'summary',
    title: 'Blog | Lindy\'s Five',
    description: 'Buffalo sports coverage - Sabres game recaps, Bills analysis, and more.',
  },
  alternates: {
    canonical: 'https://lindysfive.com/blog',
  },
};

const TYPE_LABELS: Record<string, string> = {
  'news-analysis': 'News',
  'news': 'News',
  'game-recap': 'Game Recaps',
  'set-recap': 'Set Recaps',
  'weekly-roundup': 'Weekly Roundup',
  'custom': 'Articles',
};

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const params = await searchParams;
  const typeFilter = params.type as PostType | undefined;

  const posts = await getPublishedPosts(undefined, typeFilter);

  // Group posts for sectioned layout
  let heroPost: BlogPost | null = null;
  let newsPosts: BlogPost[] = [];
  let gameRecapPosts: BlogPost[] = [];
  let setRecapPosts: BlogPost[] = [];

  if (!typeFilter && posts.length > 0) {
    const pinnedPost = posts.find(p => p.pinned);
    heroPost = pinnedPost || posts[0];

    newsPosts = posts.filter(p =>
      p.type === 'news-analysis' || p.type === 'weekly-roundup'
    );
    gameRecapPosts = posts.filter(p => p.type === 'game-recap');
    setRecapPosts = posts.filter(p => p.type === 'set-recap');
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: "Lindy's Five Blog",
    description: 'Buffalo sports coverage - Sabres game recaps, Bills analysis, and more',
    url: 'https://lindysfive.com/blog',
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Blue Header Section */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: '#003087',
            borderBottomColor: '#0A1128',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-6">
            {/* Back link */}
            <Link
              href="/sabres"
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back to Tracker</span>
            </Link>

            {/* Header Content */}
            <div className="text-center">
              <h1
                className="text-5xl md:text-7xl font-bold text-white mb-2"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Lindy&apos;s Five Blog
              </h1>
              <p className="text-xl text-white/80 mb-8">
                Buffalo Sports Coverage
              </p>
              <div className="flex justify-center">
                <BlogNav variant="dark" />
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-8">
          {/* Content */}
          <main>
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <p
                  className="text-gray-500 text-2xl mb-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  No Posts Yet
                </p>
                <p className="text-gray-400 text-sm">
                  Check back soon for Buffalo sports coverage!
                </p>
              </div>
            ) : typeFilter ? (
              /* Filtered View */
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h2
                    className="text-2xl md:text-3xl font-bold text-gray-900"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {TYPE_LABELS[typeFilter] || 'All Posts'}
                  </h2>
                  <Link
                    href="/blog"
                    className="text-[#003087] hover:text-[#002060] font-semibold text-sm transition-colors"
                  >
                    ← Back to All Posts
                  </Link>
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {posts.map((post) => (
                    <PostCard key={post.id} post={post} />
                  ))}
                </div>
              </div>
            ) : (
              /* Sectioned View */
              <>
                {/* Hero Section */}
                {heroPost && (
                  <section className="mb-12">
                    <HeroCard post={heroPost} />
                  </section>
                )}

                {/* News Section */}
                <BlogSection
                  title="Latest News"
                  posts={newsPosts.slice(0, 3)}
                  viewAllLink="/blog?type=news-analysis"
                />

                {/* Game Recaps Section */}
                <BlogSection
                  title="Game Recaps"
                  posts={gameRecapPosts.slice(0, 3)}
                  viewAllLink="/blog?type=game-recap"
                />

                {/* Set Recaps Section */}
                <BlogSection
                  title="Set Recaps"
                  posts={setRecapPosts.slice(0, 3)}
                  viewAllLink="/blog?type=set-recap"
                />
              </>
            )}
          </main>

          {/* Footer */}
          <footer className="text-center mt-16 text-gray-500 text-sm">
            <p>&copy; {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
