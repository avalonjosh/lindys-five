import { Link } from 'react-router-dom';
import PostCard from './PostCard';
import type { BlogPost } from '../../types';

interface BlogSectionProps {
  title: string;
  posts: BlogPost[];
  viewAllLink: string;
}

export default function BlogSection({ title, posts, viewAllLink }: BlogSectionProps) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <section className="mb-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <h2
          className="text-2xl md:text-3xl font-bold text-gray-900"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          {title}
        </h2>
        <Link
          to={viewAllLink}
          className="text-[#003087] hover:text-[#002060] font-semibold text-sm transition-colors"
        >
          View All →
        </Link>
      </div>

      {/* Horizontal line */}
      <div className="h-px bg-gradient-to-r from-[#003087] via-gray-200 to-transparent mb-6" />

      {/* Posts Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
