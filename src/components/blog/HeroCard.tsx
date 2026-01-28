import { Link } from 'react-router-dom';
import type { BlogPost } from '../../types';

interface HeroCardProps {
  post: BlogPost;
}

const teamColors = {
  sabres: {
    primary: '#003087',
    accent: '#FFB81C',
  },
  bills: {
    primary: '#00338D',
    accent: '#C60C30',
  },
};

export default function HeroCard({ post }: HeroCardProps) {
  const formattedDate = post.publishedAt
    ? new Date(post.publishedAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Draft';

  const typeLabel = {
    'game-recap': 'Game Recap',
    'set-recap': 'Set Recap',
    'custom': 'Article',
    'weekly-roundup': 'Weekly Roundup',
    'news-analysis': 'News',
  }[post.type];

  const colors = teamColors[post.team];

  return (
    <Link
      to={`/blog/${post.team}/${post.slug}`}
      className="group relative block bg-white rounded-2xl overflow-hidden shadow-xl border-2 transition-all duration-300 hover:shadow-2xl"
      style={{ borderColor: colors.primary }}
    >
      {/* Left accent border */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2"
        style={{ backgroundColor: colors.primary }}
      />

      <article className="p-6 md:p-8 pl-8 md:pl-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          {post.pinned && (
            <span
              className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide text-white"
              style={{ backgroundColor: colors.accent }}
            >
              Featured
            </span>
          )}
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-gray-100"
            style={{ color: colors.primary }}
          >
            {typeLabel}
          </span>
          {post.opponent && (
            <span className="text-gray-500 text-sm">
              vs {post.opponent}
            </span>
          )}
        </div>

        {/* Title */}
        <h2
          className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 group-hover:opacity-80 transition-opacity"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {post.title}
        </h2>

        {/* Excerpt - not clamped for hero */}
        <p className="text-gray-600 text-base mb-6">
          {post.excerpt}
        </p>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <time dateTime={post.publishedAt || post.createdAt} className="text-gray-500 text-sm">
            {formattedDate}
          </time>
          <span
            className="font-semibold text-base group-hover:translate-x-1 transition-transform"
            style={{ color: colors.primary }}
          >
            Read More →
          </span>
        </div>
      </article>
    </Link>
  );
}
