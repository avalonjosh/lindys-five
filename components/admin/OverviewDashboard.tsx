'use client';

// Overview home — glanceable "what happened since I last looked" dashboard.
// Every card links to the tab that owns it.

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Eye, Users, FileText, TrendingUp, Zap, Radio, ArrowRight, DollarSign } from 'lucide-react';
import { fetchPosts, updatePost } from '@/lib/services/blogApi';
import { getCronJobs, upcomingRuns } from '@/lib/cronSchedule';
import {
  Card, PageHeader, SectionHeading, Button, Toggle, Badge, Spinner, StatCard,
  WarningBanner, EmptyState, useToast,
} from './ui';
import type { BlogPost, NewsletterSubscriber } from '@/lib/types';
import type { AffiliatesPayload } from '@/app/api/admin/affiliates/route';

const money = (n: number) => `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Friendly names for cron slugs shown in the automation snapshot.
const CRON_LABELS: Record<string, string> = {
  'weekly-roundup': 'Sabres Weekly Roundup',
  'news-scan': 'Sabres News Scan',
  'game-recap': 'Sabres Game Recaps',
  'set-recap': 'Sabres Set Recap',
  'playoff-game-recap': 'Playoff Game Recaps',
  'series-recap': 'Playoff Series Recaps',
  'bills-news-scan': 'Bills News Scan',
  'bills-weekly-roundup': 'Bills Weekly Roundup',
  'bills-game-recap': 'Bills Game Recaps',
  'weekly-digest': 'Weekly Digest Email',
  'email-game-recap': 'Game Recap Emails',
  'email-set-recap': 'Set Recap Emails',
  'email-mlb-game-recap': 'MLB Recap Emails',
  'email-mlb-set-recap': 'MLB Set Recap Emails',
  'analytics-cleanup': 'Analytics Cleanup',
};

// Content-cron auto-publish toggles surfaced when off (they gate the pipeline).
const AUTO_PUBLISH_KEYS: Record<string, string> = {
  'auto-publish-weekly': 'Sabres Weekly',
  'auto-publish-news': 'Sabres News',
  'auto-publish-game-recap': 'Sabres Game Recaps',
  'auto-publish-set-recap': 'Sabres Set Recaps',
  'auto-publish-playoff-game-recap': 'Playoff Recaps',
  'auto-publish-series-recap': 'Series Recaps',
  'auto-publish-bills-news': 'Bills News',
  'auto-publish-bills-weekly': 'Bills Weekly',
  'auto-publish-bills-game-recap': 'Bills Game Recaps',
};

function timeAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function teamBadgeColor(team: string) {
  if (team === 'sabres') return '#003087';
  if (team === 'bills') return '#C60C30';
  return '#475569';
}

export default function OverviewDashboard() {
  const { toast } = useToast();
  const [todayViews, setTodayViews] = useState<number | null>(null);
  const [viewsChange, setViewsChange] = useState<number | null>(null);
  const [weekViews, setWeekViews] = useState<number | null>(null);
  const [ga4Error, setGa4Error] = useState<string | null>(null);
  const [liveNow, setLiveNow] = useState<number | null>(null);
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [drafts, setDrafts] = useState<BlogPost[]>([]);
  const [settings, setSettings] = useState<Record<string, boolean>>({});
  const [affiliates, setAffiliates] = useState<AffiliatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  // Next three runs across every cron in vercel.json (DST-correct ET).
  const nextRuns = useMemo(() => upcomingRuns(3), []);
  const cronCount = useMemo(() => getCronJobs().length, []);

  const loadData = useCallback(async () => {
    const [todayRes, weekRes, rtRes, subRes, postsData, settingsRes] = await Promise.all([
      fetch('/api/analytics/overview?range=today').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/analytics/overview?range=7d').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/analytics/realtime').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/newsletter/subscribers', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetchPosts({ limit: 100 }).catch(() => null),
      fetch('/api/blog/settings', { credentials: 'include' }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);

    if (todayRes) {
      setTodayViews(todayRes.totalViews ?? 0);
      setViewsChange(todayRes.viewsChange ?? null);
      setGa4Error(todayRes.error || null);
    }
    if (weekRes) setWeekViews(weekRes.totalViews ?? 0);
    if (rtRes && !rtRes.error) setLiveNow(rtRes.activeUsers ?? null);
    if (subRes) setSubscribers(subRes.subscribers || []);
    if (postsData) {
      setDrafts(
        postsData.posts
          .filter((p) => p.status === 'draft')
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      );
    }
    if (settingsRes) setSettings(settingsRes.settings || {});
    setLoading(false);

    // Affiliate networks are slower (two external APIs, KV-cached 30 min); load after first paint.
    fetch('/api/admin/affiliates?range=30d', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setAffiliates(d))
      .catch(() => null);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const subStats = useMemo(() => {
    const verified = subscribers.filter((s) => s.verified && !s.unsubscribedAt).length;
    const weekAgo = Date.now() - 7 * 86400000;
    const newThisWeek = subscribers.filter((s) => new Date(s.createdAt).getTime() >= weekAgo).length;
    const newest = [...subscribers]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
    return { verified, newThisWeek, newest };
  }, [subscribers]);

  const offToggles = useMemo(
    () => Object.entries(AUTO_PUBLISH_KEYS).filter(([key]) => settings[key] === false).map(([, label]) => label),
    [settings]
  );

  async function handlePublishToggle(post: BlogPost) {
    setTogglingStatus(post.id);
    try {
      const result = await updatePost(post.slug, { status: 'published' });
      setDrafts((prev) => prev.filter((p) => p.id !== post.id));
      if (result.tweet?.skipped) toast('Published (tweet skipped — already posted)');
      else if (result.tweet && !result.tweet.success) toast('Published, but posting to X failed', 'error');
      else if (result.tweet?.tweetId || result.tweet?.success) toast('Published — posted to X');
      else toast('Published');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to publish', 'error');
    } finally {
      setTogglingStatus(null);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Overview" description="Your site at a glance." />
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Overview"
        description="Your site at a glance — traffic, drafts, subscribers, and automation."
      />

      {ga4Error && (
        <div className="mb-6">
          <WarningBanner>
            <strong>Google Analytics unavailable:</strong> {ga4Error}. Traffic numbers here and on the
            Analytics tab will show zeros until the keys are fixed in Vercel.
          </WarningBanner>
        </div>
      )}

      {/* Stat row */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Eye className="h-5 w-5" />}
          label="Views today"
          value={todayViews != null ? todayViews.toLocaleString() : '—'}
          delta={viewsChange != null && viewsChange !== 0 ? { value: viewsChange, label: 'vs yesterday', format: (n) => `${n > 0 ? '+' : ''}${n}%` } : undefined}
          sub={liveNow != null && liveNow > 0 ? `${liveNow} on the site right now` : undefined}
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="Views · 7 days"
          value={weekViews != null ? weekViews.toLocaleString() : '—'}
        />
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="Subscribers"
          value={subStats.verified}
          delta={subStats.newThisWeek > 0 ? { value: subStats.newThisWeek, label: 'new this week' } : undefined}
        />
        <StatCard
          icon={<FileText className="h-5 w-5" />}
          label="Drafts pending"
          value={drafts.length}
          sub={drafts.length > 0 ? 'awaiting review below' : 'all caught up'}
        />
      </div>

      {/* Affiliate earnings snapshot */}
      <AffiliatesSnapshot data={affiliates} />

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        {/* Drafts awaiting review */}
        <Card className="lg:col-span-2" padding={false}>
          <div className="flex items-center justify-between p-4 pb-0 sm:p-5 sm:pb-0">
            <SectionHeading className="mb-0 w-full border-0 pb-0">
              Drafts awaiting review
              <span className="ml-2 text-sm font-normal text-gray-400">({drafts.length})</span>
            </SectionHeading>
            <Link href="/admin/posts" className="flex shrink-0 items-center gap-1 text-sm text-sabres-blue hover:underline">
              All posts <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {drafts.length === 0 ? (
            <EmptyState>No drafts pending — everything&apos;s published or reviewed.</EmptyState>
          ) : (
            <div className="mt-3 divide-y divide-gray-100">
              {drafts.slice(0, 6).map((post) => (
                <div key={post.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/posts/${post.slug}`}
                      className="block truncate text-sm font-medium text-gray-900 hover:text-sabres-blue"
                      title={post.title}
                    >
                      {post.title}
                    </Link>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                      <Badge className="uppercase" style={{ backgroundColor: teamBadgeColor(post.team), color: '#fff' }}>
                        {post.team}
                      </Badge>
                      {post.factCheck && !post.factCheck.passed && (
                        <Badge variant="error" title={post.factCheck.issues.join('; ')}>Fact-check blocked</Badge>
                      )}
                      <span>{timeAgo(post.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-gray-400">Publish</span>
                    <Toggle
                      checked={false}
                      onChange={() => handlePublishToggle(post)}
                      disabled={togglingStatus !== null}
                      busy={togglingStatus === post.id}
                    />
                  </div>
                </div>
              ))}
              {drafts.length > 6 && (
                <div className="px-4 py-3 text-center sm:px-5">
                  <Button href="/admin/posts" variant="ghost" size="sm">
                    View all {drafts.length} drafts
                  </Button>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Newest subscribers */}
        <Card padding={false}>
          <div className="flex items-center justify-between p-4 pb-0 sm:p-5 sm:pb-0">
            <SectionHeading className="mb-0 w-full border-0 pb-0">Newest subscribers</SectionHeading>
            <Link href="/admin/subscribers" className="flex shrink-0 items-center gap-1 text-sm text-sabres-blue hover:underline">
              All <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {subStats.newest.length === 0 ? (
            <EmptyState>No subscribers yet</EmptyState>
          ) : (
            <div className="mt-3 divide-y divide-gray-100">
              {subStats.newest.map((sub) => (
                <div key={sub.id} className="px-4 py-3 sm:px-5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-gray-900">{sub.email}</span>
                    <span className="shrink-0 text-xs text-gray-400">{timeAgo(sub.createdAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-400">
                    {sub.unsubscribedAt ? (
                      <Badge variant="error">Unsubscribed</Badge>
                    ) : sub.verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                    <span className="truncate">{sub.teams.join(', ')}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Automation snapshot */}
      <Card>
        <SectionHeading
          actions={
            <Link href="/admin/posts" className="flex items-center gap-1 text-sm text-sabres-blue hover:underline">
              Manage <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        >
          <span className="flex items-center gap-2">
            <Zap className="h-4 w-4" /> Automation
            <span className="text-sm font-normal text-gray-400">({cronCount} scheduled jobs)</span>
          </span>
        </SectionHeading>
        <div className="grid gap-4 sm:grid-cols-3">
          {nextRuns.map((job) => (
            <div key={job.slug} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
              <p className="text-sm font-semibold text-gray-900">{CRON_LABELS[job.slug] ?? job.slug}</p>
              <p className="mt-0.5 text-xs text-gray-500">{job.humanSchedule}</p>
              <p className="mt-1 flex items-center gap-1 text-xs font-medium text-sabres-blue">
                <Radio className="h-3 w-3" /> next: {job.nextRunLabel}
              </p>
            </div>
          ))}
        </div>
        {offToggles.length > 0 && (
          <p className="mt-4 text-xs text-gray-500">
            <span className="font-semibold text-amber-600">Auto-publish off:</span>{' '}
            {offToggles.join(', ')} — these land as drafts for review.
          </p>
        )}
      </Card>
    </div>
  );
}

function AffiliatesSnapshot({ data }: { data: AffiliatesPayload | null }) {
  const totals = (data?.networks || []).reduce(
    (acc, n) => ({ clicks: acc.clicks + n.clicks, sales: acc.sales + n.conversions, commission: acc.commission + n.commission, pending: acc.pending + n.pendingCommission }),
    { clicks: 0, sales: 0, commission: 0, pending: 0 },
  );
  const latest = (data?.networks || []).flatMap((n) => n.recentSales).sort((a, b) => b.date.localeCompare(a.date))[0];
  const onSite = data?.firstParty.total ?? 0;

  return (
    <Card className="mb-6" padding={false}>
      <div className="flex items-center justify-between p-4 pb-0 sm:p-5 sm:pb-0">
        <SectionHeading className="mb-0 w-full border-0 pb-0">
          <span className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" /> Affiliates
            <span className="text-sm font-normal text-gray-400">(last 30 days)</span>
          </span>
        </SectionHeading>
        <Link href="/admin/affiliates" className="flex shrink-0 items-center gap-1 text-sm text-sabres-blue hover:underline">
          Details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      {!data ? (
        <div className="flex justify-center py-8"><Spinner size="sm" /></div>
      ) : (
        <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-5">
          <div className="grid grid-cols-3 gap-3 lg:col-span-3">
            <MiniStat label="Commission" value={money(totals.commission)} sub={totals.pending > 0 ? `${money(totals.pending)} pending` : 'all approved'} strong />
            <MiniStat label="Sales" value={String(totals.sales)} sub={totals.clicks > 0 ? `${((totals.sales / totals.clicks) * 100).toFixed(1)}% of clicks` : 'no clicks yet'} />
            <MiniStat label="Clicks" value={totals.clicks.toLocaleString()} sub={`${onSite.toLocaleString()} on-site`} />
          </div>
          <div className="space-y-2 lg:col-span-2">
            {data.networks.map((n) => (
              <div key={n.network} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: n.error ? '#d97706' : n.configured ? '#16a34a' : '#9ca3af' }} title={n.error || (n.configured ? 'connected' : 'not configured')} />
                  <span className="font-medium text-gray-800">{n.network === 'fanatics' ? 'Fanatics' : 'StubHub'}</span>
                </span>
                <span className="tabular-nums text-gray-500">
                  {n.clicks} clk · {n.conversions} sale{n.conversions === 1 ? '' : 's'} · <span className="font-semibold text-gray-800">{money(n.commission)}</span>
                </span>
              </div>
            ))}
            <p className="truncate text-xs text-gray-400" title={latest ? `${latest.ref} · ${latest.detail || ''}` : undefined}>
              {latest
                ? `Latest sale: ${money(latest.commission)} on ${latest.network === 'fanatics' ? 'Fanatics' : 'StubHub'} · ${timeAgo(latest.date)}`
                : 'No sales in the last 30 days'}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}

function MiniStat({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">{label}</p>
      <p className={`mt-0.5 text-xl font-bold ${strong ? 'text-green-700' : 'text-gray-900'}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
    </div>
  );
}
