import { Link } from 'react-router-dom';
import type { BlogPost } from '../../types';

interface PostCardProps {
  post: BlogPost;
}

const teamStyles = {
  sabres: {
    gradient: 'from-[#002654] to-[#001a3d]',
    border: 'border-[#FCB514]',
    accent: '#FCB514',
    hoverShadow: 'hover:shadow-[#FCB514]/50',
  },
  bills: {
    gradient: 'from-[#00338D] to-[#002366]',
    border: 'border-[#C60C30]',
    accent: '#C60C30',
    hoverShadow: 'hover:shadow-[#C60C30]/50',
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
  }[post.type];

  const styles = teamStyles[post.team];

  return (
    <Link
      to={`/blog/${post.team}/${post.slug}`}
      className={`group relative bg-gradient-to-br ${styles.gradient} rounded-2xl p-6 shadow-2xl border-2 ${styles.border} transition-all duration-300 hover:scale-[1.02] ${styles.hoverShadow}`}
    >
      <article>
        <div className="flex items-center justify-between mb-3">
          <span
            className="px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wide bg-black/30"
            style={{ color: styles.accent }}
          >
            {typeLabel}
          </span>
          {post.opponent && (
            <span className="text-gray-400 text-xs">
              vs {post.opponent}
            </span>
          )}
        </div>

        <h3
          className="text-xl md:text-2xl font-bold text-white mb-2 group-hover:opacity-90 transition-opacity"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {post.title}
        </h3>

        <p className="text-gray-300 text-sm mb-4 line-clamp-2">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between">
          <time dateTime={post.publishedAt || post.createdAt} className="text-gray-400 text-xs">
            {formattedDate}
          </time>
          <div className="flex items-center gap-3">
            {post.aiGenerated && (
              <span className="bg-black/30 text-purple-300 px-2 py-0.5 rounded text-xs">
                AI
              </span>
            )}
            <span
              className="font-semibold text-sm"
              style={{ color: styles.accent }}
            >
              Read →
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
