import Link from 'next/link';
import Image from 'next/image';
import type { BlogPost } from '@/lib/types';
import { TEAMS } from '@/lib/teamConfig';
import CardArt from './CardArt';

interface PostCardProps {
  post: BlogPost;
}

const teamColors: Record<string, { primary: string }> = {
  sabres: {
    primary: '#003087',
  },
  bills: {
    primary: '#00338D',
  },
};

function getTeamColors(team: string) {
  if (teamColors[team]) return teamColors[team];
  const nhlTeam = TEAMS[team];
  if (nhlTeam) return { primary: nhlTeam.colors.primary };
  return teamColors.sabres;
}

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
    'news-analysis': 'News',
    'playoff-game-recap': 'Playoff Recap',
    'series-recap': 'Series Recap',
  }[post.type];

  const colors = getTeamColors(post.team);

  return (
    <Link
      href={`/blog/${post.team}/${post.slug}`}
      className="group relative overflow-hidden rounded-2xl border-2 border-gray-200 bg-white shadow-xl transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
    >
      <article>
        {/* Card visual: generated image, or team-branded fallback art */}
        {post.ogImage ? (
          <div className="relative aspect-[1200/630] w-full overflow-hidden">
            <Image
              src={post.ogImage}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <CardArt team={post.team} typeLabel={typeLabel} className="aspect-[1200/630] w-full" />
        )}

        <div className="p-4 md:p-5">
          <div className="mb-3 flex items-center justify-between">
            <span
              className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide"
              style={{ color: colors.primary }}
            >
              {typeLabel}
            </span>
            {post.opponent && (
              <span className="text-xs text-gray-500">
                vs {post.opponent}
              </span>
            )}
          </div>

          <h3
            className="mb-2 text-xl font-bold text-gray-900 transition-opacity group-hover:opacity-80 md:text-2xl"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            {post.title}
          </h3>

          <p className="mb-4 line-clamp-2 text-sm text-gray-600">
            {post.excerpt}
          </p>

          <div className="flex items-center justify-between">
            <time dateTime={post.publishedAt || post.createdAt} className="text-xs text-gray-500">
              {formattedDate}
            </time>
            <span
              className="text-sm font-semibold"
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
