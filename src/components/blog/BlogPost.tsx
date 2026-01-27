import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import PostContent from './PostContent';
import { fetchPost } from '../../services/blogApi';
import type { BlogPost as BlogPostType } from '../../types';

const teamConfig = {
  sabres: {
    displayName: 'Sabres',
    primary: '#003087',
    secondary: '#0A1128',
    accent: '#FFB81C',
  },
  bills: {
    displayName: 'Bills',
    primary: '#00338D',
    secondary: '#00338D',
    accent: '#C60C30',
  },
};

export default function BlogPost() {
  const { team, slug } = useParams<{ team: string; slug: string }>();
  const [post, setPost] = useState<BlogPostType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const config = team && (team === 'sabres' || team === 'bills') ? teamConfig[team] : teamConfig.sabres;

  useEffect(() => {
    async function loadPost() {
      if (!slug) return;
      try {
        setLoading(true);
        const data = await fetchPost(slug);
        setPost(data.post);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post');
      } finally {
        setLoading(false);
      }
    }
    loadPost();
  }, [slug]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200"
          style={{ borderTopColor: config.primary }}
        ></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link
            to={`/blog/${team}`}
            className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to posts</span>
          </Link>
          <div className="text-center py-16">
            <h1
              className="text-3xl font-bold text-gray-900 mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Post Not Found
            </h1>
            <p className="text-gray-500">
              {error || "The post you're looking for doesn't exist."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Draft';

  const readingTime = Math.ceil(post.content.split(/\s+/).length / 200);

  const typeLabel = {
    'game-recap': 'Game Recap',
    'set-recap': 'Set Recap',
    'custom': 'Article',
  }[post.type];

  const postConfig = teamConfig[post.team];

  return (
    <>
      <Helmet>
        <title>{post.title} | Lindy's Five</title>
        <meta name="description" content={post.metaDescription || post.excerpt} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.metaDescription || post.excerpt} />
        <meta property="og:type" content="article" />
        {post.ogImage && <meta property="og:image" content={post.ogImage} />}
        <meta property="article:published_time" content={post.publishedAt || post.createdAt} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={post.title} />
        <meta name="twitter:description" content={post.metaDescription || post.excerpt} />
        <link rel="canonical" href={`https://lindysfive.com/blog/${post.team}/${post.slug}`} />

        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": post.title,
            "description": post.metaDescription || post.excerpt,
            "datePublished": post.publishedAt || post.createdAt,
            "dateModified": post.updatedAt,
            "author": {
              "@type": "Organization",
              "name": "Lindy's Five"
            },
            "publisher": {
              "@type": "Organization",
              "name": "Lindy's Five"
            },
            ...(post.ogImage && { "image": post.ogImage })
          })}
        </script>
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Blue Header Section */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: postConfig.primary,
            borderBottomColor: postConfig.secondary,
          }}
        >
          <div className="max-w-3xl mx-auto px-4 py-6">
            {/* Back link */}
            <Link
              to={`/blog/${team}`}
              className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to {postConfig.displayName} Posts</span>
            </Link>

            {/* Post Meta */}
            <div className="flex items-center gap-3 mb-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide"
                style={{ backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }}
              >
                {typeLabel}
              </span>
              {post.opponent && (
                <span className="text-white/70 text-sm">
                  vs {post.opponent}
                </span>
              )}
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-white/70">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {readingTime} min read
              </span>
              {post.aiGenerated && (
                <span className="bg-purple-400/30 text-white px-2 py-0.5 rounded text-xs">
                  AI Generated
                </span>
              )}
            </div>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-4 py-8">
          {/* Content */}
          <div className="bg-white rounded-2xl p-6 md:p-8 shadow-xl border-2 border-gray-200">
            <PostContent content={post.content} accent={postConfig.primary} />
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-gray-200">
            <Link
              to={`/blog/${team}`}
              className="inline-flex items-center gap-2 transition-colors hover:opacity-80"
              style={{ color: postConfig.primary }}
            >
              <ArrowLeft className="w-4 h-4" />
              More {postConfig.displayName} posts
            </Link>
          </footer>
        </article>
      </div>
    </>
  );
}
