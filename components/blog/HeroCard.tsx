import Link from 'next/link';
import Image from 'next/image';
import type { BlogPost } from '@/lib/types';
import { TEAMS } from '@/lib/teamConfig';
import CardArt from './CardArt';

interface HeroCardProps {
  post: BlogPost;
}

const teamColors: Record<string, { primary: string; accent: string }> = {
  sabres: {
    primary: '#003087',
    accent: '#FFB81C',
  },
  bills: {
    primary: '#00338D',
    accent: '#C60C30',
  },
};

function getTeamColors(team: string) {
  if (teamColors[team]) return teamColors[team];
  const nhlTeam = TEAMS[team];
  if (nhlTeam) return { primary: nhlTeam.colors.primary, accent: nhlTeam.colors.accent };
  return teamColors.sabres;
}

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
    'playoff-game-recap': 'Playoff Recap',
    'series-recap': 'Series Recap',
  }[post.type];

  const colors = getTeamColors(post.team);
  const hasImage = !!post.ogImage;

  return (
    <Link
      href={`/blog/${post.team}/${post.slug}`}
      className="group relative block bg-white rounded-2xl overflow-hidden shadow-xl border-2 transition-all duration-300 hover:shadow-2xl"
      style={{ borderColor: colors.primary }}
    >
      {/* Layout: Mobile = image top, Desktop = image left */}
      <div className="flex flex-col md:flex-row">
        {/* Featured Image (generated card, or team-branded fallback art) */}
        <div className="relative md:w-2/5 flex-shrink-0">
          {hasImage ? (
            <>
              <Image
                src={post.ogImage!}
                alt={post.title}
                width={600}
                height={400}
                className="w-full h-48 md:h-full md:min-h-[280px] object-cover"
              />
              {/* Gradient overlay for mobile */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent md:bg-gradient-to-r md:from-transparent md:to-transparent" />
            </>
          ) : (
            <CardArt team={post.team} className="h-48 w-full md:h-full md:min-h-[280px]" />
          )}
        </div>

        {/* Content Section */}
        <div className="relative md:w-3/5">
          <article className="p-6 md:p-8">
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
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
        </div>
      </div>
    </Link>
  );
}
