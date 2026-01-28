import { Link } from 'react-router-dom';
import type { BlogPost } from '../../types';

interface PostCardProps {
  post: BlogPost;
}

const teamColors = {
  sabres: {
    primary: '#003087',
  },
  bills: {
    primary: '#00338D',
  },
};

export default function PostCard({ post }: PostCardProps) {
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
    'news-analysis': 'News Analysis',
  }[post.type];

  const colors = teamColors[post.team];

  return (
    <Link
      to={`/blog/${post.team}/${post.slug}`}
      className="group relative bg-white rounded-2xl p-4 md:p-5 shadow-xl border-2 border-gray-200 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
    >
      <article>
        <div className="flex items-center justify-between mb-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-gray-100"
            style={{ color: colors.primary }}
          >
            {typeLabel}
          </span>
          {post.opponent && (
            <span className="text-gray-500 text-xs">
              vs {post.opponent}
            </span>
          )}
        </div>

        <h3
          className="text-xl md:text-2xl font-bold text-gray-900 mb-2 group-hover:opacity-80 transition-opacity"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {post.title}
        </h3>

        <p className="text-gray-600 text-sm mb-4 line-clamp-2">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between">
          <time dateTime={post.publishedAt || post.createdAt} className="text-gray-500 text-xs">
            {formattedDate}
          </time>
          <div className="flex items-center gap-3">
            <span
              className="font-semibold text-sm"
              style={{ color: colors.primary }}
            >
              Read →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
