import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Calendar, Clock } from 'lucide-react';
import { getPostBySlug } from '@/lib/kv';
import PostContent from '@/components/blog/PostContent';
import AuthorByline from '@/components/blog/AuthorByline';
import NextGameCTA from '@/components/blog/NextGameCTA';
import ViewTracker from '@/components/blog/ViewTracker';
import NewsletterSignup from '@/components/newsletter/NewsletterSignup';
import MerchCTA from '@/components/affiliate/MerchCTA';

export const dynamic = 'force-dynamic';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ team: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return {
      title: 'Post Not Found',
    };
  }

  return {
    title: post.title,
    description: post.metaDescription || post.excerpt,
    openGraph: {
      title: post.title,
      description: post.metaDescription || post.excerpt,
      type: 'article',
      url: `https://www.lindysfive.com/blog/${post.team}/${post.slug}`,
      siteName: "Lindy's Five",
      publishedTime: post.publishedAt || post.createdAt,
      ...(post.ogImage && { images: [{ url: post.ogImage }] }),
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.metaDescription || post.excerpt,
      ...(post.ogImage && { images: [post.ogImage] }),
    },
    alternates: {
      canonical: `https://www.lindysfive.com/blog/${post.team}/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ team: string; slug: string }>;
}) {
  const { team, slug } = await params;

  const config = teamConfig[team as keyof typeof teamConfig];
  if (!config) {
    notFound();
  }

  const post = await getPostBySlug(slug);

  if (!post) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        <div className="max-w-3xl mx-auto px-4 py-12">
          <Link
            href={`/blog/${team}`}
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
              The post you&apos;re looking for doesn&apos;t exist.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const postConfig = teamConfig[post.team];

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
    'weekly-roundup': 'Weekly Roundup',
    'news-analysis': 'News',
  }[post.type];

  const showTicketCTA =
    (post.type === 'game-recap' || post.type === 'set-recap' || post.type === 'news-analysis') &&
    post.team === 'sabres';

  // Show tracker CTA for any team that has a tracker page
  const TEAMS_WITH_TRACKERS = new Set([
    'sabres', 'canadiens', 'redwings', 'senators', 'panthers', 'mapleleafs',
    'lightning', 'bruins', 'devils', 'penguins', 'hurricanes', 'capitals',
    'islanders', 'flyers', 'bluejackets', 'rangers', 'utah', 'avalanche',
    'jets', 'stars', 'blackhawks', 'predators', 'wild', 'blues',
    'goldenknights', 'oilers', 'canucks', 'flames', 'kings', 'ducks',
    'sharks', 'kraken',
  ]);
  const showTrackerCTA = TEAMS_WITH_TRACKERS.has(post.team);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.metaDescription || post.excerpt,
    datePublished: post.publishedAt || post.createdAt,
    dateModified: post.updatedAt,
    author: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    publisher: {
      '@type': 'Organization',
      name: "Lindy's Five",
    },
    ...(post.ogImage && { image: post.ogImage }),
  };

  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.lindysfive.com',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `https://www.lindysfive.com/blog/${team}`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: config.displayName,
        item: `https://www.lindysfive.com/blog/${team}`,
      },
      {
        '@type': 'ListItem',
        position: 4,
        name: post.title,
        item: `https://www.lindysfive.com/blog/${team}/${slug}`,
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <ViewTracker slug={slug} />

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
              href={`/blog/${team}`}
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
            </div>
          </div>
        </header>

        <article className="max-w-3xl mx-auto px-4 py-8">
          {/* Content */}
          <div className="bg-white rounded-2xl shadow-xl border-2 border-gray-200 overflow-hidden">
            {/* Featured Image */}
            {post.ogImage && (
              <Image
                src={post.ogImage}
                alt={post.title}
                width={800}
                height={450}
                className="w-full h-auto"
                priority
              />
            )}
            <div className="p-6 md:p-8">
              <PostContent content={post.content} accent={postConfig.primary} />
              <AuthorByline accentColor={postConfig.primary} />
            </div>
          </div>

          {/* Newsletter Signup */}
          <NewsletterSignup
            teams={[post.team]}
            variant="inline"
            source="blog-post"
            teamDisplayName={postConfig.displayName}
            primaryColor={postConfig.primary}
            accentColor={postConfig.accent}
          />

          {/* Merch CTA */}
          {post.team === 'sabres' && (
            <MerchCTA
              teamCity="Buffalo"
              teamName="Sabres"
              sport="nhl"
              variant="card"
              primaryColor={postConfig.primary}
            />
          )}

          {/* Next Game CTA - For Sabres articles */}
          {showTicketCTA && (
            <NextGameCTA
              team={post.team}
              primaryColor={postConfig.primary}
              accentColor={postConfig.accent}
            />
          )}

          {/* Tracker CTA - For all teams with tracker pages */}
          {showTrackerCTA && (
            <div className="mt-4">
              <Link
                href={`/nhl/${post.team}`}
                className="block rounded-2xl p-6 shadow-xl border-2 transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl"
                style={{
                  background: `linear-gradient(135deg, ${postConfig.primary} 0%, ${postConfig.secondary} 100%)`,
                  borderColor: postConfig.accent,
                }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h3
                      className="text-2xl font-bold text-white mb-1"
                      style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                    >
                      Track the {postConfig.displayName} Season
                    </h3>
                    <p className="text-white/80 text-sm">
                      Live standings, schedule, and playoff projections
                    </p>
                  </div>
                  <div
                    className="text-4xl font-bold"
                    style={{ color: postConfig.accent, fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    →
                  </div>
                </div>
              </Link>
            </div>
          )}

          {/* Footer */}
          <footer className="mt-12 pt-8 border-t border-gray-200">
            <Link
              href={`/blog/${team}`}
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
