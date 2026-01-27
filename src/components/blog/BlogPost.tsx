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
    gradient: 'from-[#002654] to-[#001a3d]',
    border: 'border-[#FCB514]',
    accent: '#FCB514',
  },
  bills: {
    displayName: 'Bills',
    gradient: 'from-[#00338D] to-[#002366]',
    border: 'border-[#C60C30]',
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div
          className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700"
          style={{ borderTopColor: config.accent }}
        ></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link
            to={`/blog/${team}`}
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to posts</span>
          </Link>
          <div className="text-center py-16">
            <h1
              className="text-3xl font-bold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Post Not Found
            </h1>
            <p className="text-gray-400">
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

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <article className="max-w-3xl mx-auto px-4 py-8">
          {/* Back link */}
          <Link
            to={`/blog/${team}`}
            className="inline-flex items-center gap-2 mb-8 transition-colors"
            style={{ color: postConfig.accent }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to {postConfig.displayName} Posts</span>
          </Link>

          {/* Header */}
          <header className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-black/30"
                style={{ color: postConfig.accent }}
              >
                {typeLabel}
              </span>
              {post.opponent && (
                <span className="text-gray-400 text-sm">
                  vs {post.opponent}
                </span>
              )}
            </div>

            <h1
              className="text-4xl md:text-5xl font-bold text-white mb-6"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              {post.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="w-4 h-4" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {readingTime} min read
              </span>
              {post.aiGenerated && (
                <span className="bg-black/30 text-purple-300 px-2 py-0.5 rounded text-xs">
                  AI Generated
                </span>
              )}
            </div>
          </header>

          {/* Content */}
          <div className={`bg-gradient-to-br ${postConfig.gradient} rounded-2xl p-6 md:p-8 border-2 ${postConfig.border}`}>
            <PostContent content={post.content} accent={postConfig.accent} />
          </div>

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-gray-700">
            <Link
              to={`/blog/${team}`}
              className="inline-flex items-center gap-2 transition-colors"
              style={{ color: postConfig.accent }}
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
