import { useState, useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import BlogNav from './BlogNav';
import PostCard from './PostCard';
import HeroCard from './HeroCard';
import BlogSection from './BlogSection';
import { fetchPosts } from '../../services/blogApi';
import type { BlogPost, PostType } from '../../types';

const TYPE_LABELS: Record<string, string> = {
  'news-analysis': 'News',
  'news': 'News',
  'game-recap': 'Game Recaps',
  'set-recap': 'Set Recaps',
  'weekly-roundup': 'Weekly Roundup',
  'custom': 'Articles',
};

export default function Blog() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  // Check for type filter in URL
  const typeFilter = searchParams.get('type') as PostType | null;

  useEffect(() => {
    async function loadPosts() {
      try {
        setLoading(true);
        // Fetch more posts for sectioned view, or all of a type for filtered view
        const data = await fetchPosts({
          status: 'published',
          limit: typeFilter ? 50 : 30,
          type: typeFilter || undefined,
        });
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [typeFilter]);

  // Group posts for sectioned layout
  const { heroPost, newsPosts, gameRecapPosts, setRecapPosts } = useMemo(() => {
    if (typeFilter || posts.length === 0) {
      return { heroPost: null, newsPosts: [], gameRecapPosts: [], setRecapPosts: [] };
    }

    // Find pinned post or use most recent
    const pinnedPost = posts.find(p => p.pinned);
    const hero = pinnedPost || posts[0];

    // Filter remaining posts by type (exclude hero)
    const remaining = posts.filter(p => p.id !== hero?.id);

    return {
      heroPost: hero,
      newsPosts: remaining.filter(p =>
        p.type === 'news-analysis' || p.type === 'weekly-roundup'
      ),
      gameRecapPosts: remaining.filter(p => p.type === 'game-recap'),
      setRecapPosts: remaining.filter(p => p.type === 'set-recap'),
    };
  }, [posts, typeFilter]);

  // Render filtered view when type param is present
  const renderFilteredView = () => (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl md:text-3xl font-bold text-gray-900"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {TYPE_LABELS[typeFilter || ''] || 'All Posts'}
        </h2>
        <Link
          to="/blog"
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
  );

  // Render sectioned view (default)
  const renderSectionedView = () => (
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
  );

  return (
    <>
      <Helmet>
        <title>Blog | Lindy's Five</title>
        <meta name="description" content="Buffalo sports coverage - Sabres game recaps, Bills analysis, and more from Lindy's Five." />
        <meta property="og:title" content="Blog | Lindy's Five" />
        <meta property="og:description" content="Buffalo sports coverage - Sabres game recaps, Bills analysis, and more." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://lindysfive.com/blog" />
        <meta property="og:site_name" content="Lindy's Five" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="Blog | Lindy's Five" />
        <meta name="twitter:description" content="Buffalo sports coverage - Sabres game recaps, Bills analysis, and more." />
        <link rel="canonical" href="https://lindysfive.com/blog" />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            "name": "Lindy's Five Blog",
            "description": "Buffalo sports coverage - Sabres game recaps, Bills analysis, and more",
            "url": "https://lindysfive.com/blog",
            "publisher": {
              "@type": "Organization",
              "name": "Lindy's Five"
            }
          })}
        </script>
      </Helmet>

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
              to="/"
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
                Lindy's Five Blog
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
            {loading ? (
              <div className="flex justify-center py-16">
                <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-[#003087]"></div>
              </div>
            ) : error ? (
              <div className="text-center py-16">
                <p className="text-red-600">{error}</p>
              </div>
            ) : posts.length === 0 ? (
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
              renderFilteredView()
            ) : (
              renderSectionedView()
            )}
          </main>

          {/* Footer */}
          <footer className="text-center mt-16 text-gray-500 text-sm">
            <p>© {new Date().getFullYear()} JRR Apps. All rights reserved.</p>
          </footer>
        </div>
      </div>
    </>
  );
}
