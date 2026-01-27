import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft } from 'lucide-react';
import BlogNav from './BlogNav';
import PostCard from './PostCard';
import { fetchPosts } from '../../services/blogApi';
import type { BlogPost } from '../../types';

const teamConfig = {
  sabres: {
    displayName: 'Buffalo Sabres',
    primary: '#003087',
  },
  bills: {
    displayName: 'Buffalo Bills',
    primary: '#00338D',
  },
};

export default function BlogList() {
  const { team } = useParams<{ team: 'sabres' | 'bills' }>();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = team ? teamConfig[team] : null;

  useEffect(() => {
    async function loadPosts() {
      if (!team) return;
      try {
        setLoading(true);
        const data = await fetchPosts({ team, status: 'published', limit: 20 });
        setPosts(data.posts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load posts');
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, [team]);

  if (!config) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <p className="text-gray-500">Invalid team</p>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{config.displayName} | Lindy's Five Blog</title>
        <meta name="description" content={`${config.displayName} coverage - game recaps, analysis, and more from Lindy's Five.`} />
        <meta property="og:title" content={`${config.displayName} | Lindy's Five Blog`} />
        <meta property="og:description" content={`${config.displayName} coverage - game recaps, analysis, and more.`} />
        <meta property="og:type" content="website" />
        <link rel="canonical" href={`https://lindysfive.com/blog/${team}`} />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Back link */}
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to Tracker</span>
          </Link>

          {/* Header */}
          <div className="text-center mb-12">
            <h1
              className="text-5xl md:text-7xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {config.displayName}
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Game Recaps & Analysis
            </p>
            <div className="flex justify-center">
              <BlogNav />
            </div>
          </div>

          {/* Content */}
          <main>
            {loading ? (
              <div className="flex justify-center py-16">
                <div
                  className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200"
                  style={{ borderTopColor: config.primary }}
                ></div>
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
                  No {config.displayName} Posts Yet
                </p>
                <p className="text-gray-400 text-sm">
                  Check back soon!
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2">
                {posts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
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
