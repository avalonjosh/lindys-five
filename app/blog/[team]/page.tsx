import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getPublishedPosts } from '@/lib/kv';
import type { BlogPost, PostType } from '@/lib/types';
import BlogNav from '@/components/blog/BlogNav';
import PostCard from '@/components/blog/PostCard';
import HeroCard from '@/components/blog/HeroCard';
import BlogSection from '@/components/blog/BlogSection';

export const revalidate = 60;

const teamConfig = {
  sabres: {
    displayName: 'Buffalo Sabres',
    primary: '#003087',
    secondary: '#0A1128',
    accent: '#FFB81C',
  },
  bills: {
    displayName: 'Buffalo Bills',
    primary: '#00338D',
    secondary: '#00338D',
    accent: '#C60C30',
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

export function generateStaticParams() {
  return [{ team: 'sabres' }, { team: 'bills' }];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string }>;
}): Promise<Metadata> {
  const { team } = await params;
  const config = teamConfig[team as keyof typeof teamConfig];
  if (!config) return {};

  return {
    title: `${config.displayName} Blog`,
    description: `${config.displayName} coverage - game recaps, analysis, and more from Lindy's Five.`,
    openGraph: {
      title: `${config.displayName} | Lindy's Five Blog`,
      description: `${config.displayName} coverage - game recaps, analysis, and more.`,
      type: 'website',
      url: `https://www.lindysfive.com/blog/${team}`,
      siteName: "Lindy's Five",
    },
    twitter: {
      card: 'summary',
      title: `${config.displayName} | Lindy's Five Blog`,
      description: `${config.displayName} coverage - game recaps, analysis, and more.`,
    },
    alternates: {
      canonical: `https://www.lindysfive.com/blog/${team}`,
    },
  };
}

export default async function TeamBlogPage({
  params,
  searchParams,
}: {
  params: Promise<{ team: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { team } = await params;
  const searchParamsResolved = await searchParams;

  const config = teamConfig[team as keyof typeof teamConfig];
  if (!config) {
    notFound();
  }

  const typeFilter = searchParamsResolved.type as PostType | undefined;
  const posts = await getPublishedPosts(team, typeFilter);

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
    name: `${config.displayName} - Lindy's Five Blog`,
    description: `${config.displayName} coverage - game recaps, analysis, and more`,
    url: `https://www.lindysfive.com/blog/${team}`,
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    about: {
      '@type': 'SportsTeam',
      name: config.displayName,
    },
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `https://www.lindysfive.com/blog/${team}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: config.displayName,
        item: `https://www.lindysfive.com/blog/${team}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Blue Header Section */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: config.primary,
            borderBottomColor: config.secondary,
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
                {config.displayName}
              </h1>
              <p className="text-xl text-white/80 mb-8">
                Game Recaps & Analysis
              </p>
              <div className="flex justify-center">
                <BlogNav variant="dark" />
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Content */}
          <main>
            {posts.length === 0 ? (
              <div className="text-center py-16">
                <p
                  className="text-gray-500 text-2xl mb-2"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  No {config.displayName} Posts Yet
                </p>
                <p className="text-gray-400 text-sm">
                  Check back soon!
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
                    href={`/blog/${team}`}
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
                  viewAllLink={`/blog/${team}?type=news-analysis`}
                />

                {/* Game Recaps Section */}
                <BlogSection
                  title="Game Recaps"
                  posts={gameRecapPosts.slice(0, 3)}
                  viewAllLink={`/blog/${team}?type=game-recap`}
                />

                {/* Set Recaps Section */}
                <BlogSection
                  title="Set Recaps"
                  posts={setRecapPosts.slice(0, 3)}
                  viewAllLink={`/blog/${team}?type=set-recap`}
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
