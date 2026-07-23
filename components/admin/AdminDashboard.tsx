'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, Eye, FileText, Pin, ChevronUp, ChevronDown, CheckSquare, Square, X, Share2, Play, Zap } from 'lucide-react';
import { fetchPosts, deletePost, updatePost } from '@/lib/services/blogApi';
import { getCronJobs } from '@/lib/cronSchedule';
import ShareToXModal from './ShareToXModal';
import {
  Card, PageHeader, Button, Toggle, Badge, Spinner, Select, SearchInput,
  Table, Th, Td, EmptyState, ErrorBanner, useToast,
} from './ui';
import type { BlogPost } from '@/lib/types';

type FilterStatus = 'all' | 'published' | 'draft';
type SortDirection = 'desc' | 'asc';
type SortField = 'date' | 'views';

const PAGE_SIZE = 25;

interface SetOption {
  setNumber: number;
  processed: boolean;
  startDate: string;
  endDate: string;
}

type AutoPublishSettings = Record<string, boolean>;

const TYPE_LABELS: Record<string, string> = {
  'game-recap': 'Game Recap',
  'playoff-game-recap': 'Playoff Recap',
  'series-recap': 'Series Recap',
  'set-recap': 'Set Recap',
  'news-analysis': 'News',
  'weekly-roundup': 'Weekly',
  custom: 'Custom',
};

// Content crons surfaced on the Posts page. Schedule text comes from
// lib/cronSchedule (parsed from vercel.json) — never hand-written here.
// Email/maintenance crons live on their own tabs.
const AUTOMATION_JOBS: {
  slug: string;
  trigger: string;
  settingKey: string;
  label: string;
  team: 'sabres' | 'bills';
  hasSetPicker?: boolean;
}[] = [
  { slug: 'weekly-roundup', trigger: 'weekly', settingKey: 'auto-publish-weekly', label: 'Weekly Roundup', team: 'sabres' },
  { slug: 'news-scan', trigger: 'news', settingKey: 'auto-publish-news', label: 'News Scan', team: 'sabres' },
  { slug: 'game-recap', trigger: 'game-recap', settingKey: 'auto-publish-game-recap', label: 'Game Recaps', team: 'sabres' },
  { slug: 'set-recap', trigger: 'set-recap', settingKey: 'auto-publish-set-recap', label: 'Set Recaps', team: 'sabres', hasSetPicker: true },
  { slug: 'playoff-game-recap', trigger: 'playoff-game-recap', settingKey: 'auto-publish-playoff-game-recap', label: 'Playoff Game Recaps', team: 'sabres' },
  { slug: 'series-recap', trigger: 'series-recap', settingKey: 'auto-publish-series-recap', label: 'Series Recaps', team: 'sabres' },
  { slug: 'bills-news-scan', trigger: 'bills-news', settingKey: 'auto-publish-bills-news', label: 'News Scan', team: 'bills' },
  { slug: 'bills-weekly-roundup', trigger: 'bills-weekly', settingKey: 'auto-publish-bills-weekly', label: 'Weekly Roundup', team: 'bills' },
  { slug: 'bills-game-recap', trigger: 'bills-game-recap', settingKey: 'auto-publish-bills-game-recap', label: 'Game Recaps', team: 'bills' },
];

function teamBadgeColor(team: string) {
  if (team === 'sabres') return '#003087';
  if (team === 'bills') return '#C60C30';
  return '#475569';
}

function teamLabel(team: string) {
  return team.charAt(0).toUpperCase() + team.slice(1);
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ type: string; success: boolean; message: string } | null>(null);
  const [autoPublishSettings, setAutoPublishSettings] = useState<AutoPublishSettings>({});
  const [togglingSettings, setTogglingSettings] = useState<string | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<BlogPost | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [bulkOperating, setBulkOperating] = useState(false);
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortField, setSortField] = useState<SortField>('date');
  const [page, setPage] = useState(0);
  const [automationOpen, setAutomationOpen] = useState(false);
  const [setOptions, setSetOptions] = useState<SetOption[]>([]);
  const [selectedSetNumber, setSelectedSetNumber] = useState<number | null>(null);
  const [loadingSets, setLoadingSets] = useState(false);

  // Schedule facts computed from vercel.json — DST-correct via Intl.
  const cronJobs = useMemo(() => {
    const all = getCronJobs();
    return new Map(all.map(j => [j.slug, j]));
  }, []);

  const nextUpcoming = useMemo(() => {
    const jobs = AUTOMATION_JOBS
      .map(j => ({ ...j, cron: cronJobs.get(j.slug) }))
      .filter(j => j.cron)
      .sort((a, b) => a.cron!.nextRun.getTime() - b.cron!.nextRun.getTime());
    return jobs[0];
  }, [cronJobs]);

  // Teams present in the data (not hardcoded)
  const teamOptions = useMemo(() => {
    return Array.from(new Set(posts.map(p => p.team))).sort();
  }, [posts]);

  const typeOptions = useMemo(() => {
    return Array.from(new Set(posts.map(p => p.type))).sort();
  }, [posts]);

  const draftCount = useMemo(() => posts.filter(p => p.status === 'draft').length, [posts]);

  const filteredPosts = useMemo(() => {
    let result = [...posts];
    const q = search.trim().toLowerCase();
    if (q) result = result.filter(p => p.title.toLowerCase().includes(q));
    if (filterTeam !== 'all') result = result.filter(p => p.team === filterTeam);
    if (filterStatus !== 'all') result = result.filter(p => p.status === filterStatus);
    if (filterType !== 'all') result = result.filter(p => p.type === filterType);

    result.sort((a, b) => {
      if (sortField === 'views') {
        const va = a.views ?? 0;
        const vb = b.views ?? 0;
        return sortDirection === 'desc' ? vb - va : va - vb;
      }
      const da = new Date(a.publishedAt || a.createdAt).getTime();
      const db = new Date(b.publishedAt || b.createdAt).getTime();
      return sortDirection === 'desc' ? db - da : da - db;
    });
    return result;
  }, [posts, search, filterTeam, filterStatus, filterType, sortDirection, sortField]);

  const pageCount = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const pagePosts = filteredPosts.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [search, filterTeam, filterStatus, filterType]);

  useEffect(() => {
    loadPosts();
    loadSettings();
    loadSetOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPosts() {
    try {
      setLoading(true);
      // Page through the API so nothing is hidden behind the old 100-post cap
      const all: BlogPost[] = [];
      let offset = 0;
      let total = Infinity;
      while (all.length < total) {
        const data = await fetchPosts({ limit: 100, offset });
        all.push(...data.posts);
        total = data.total;
        if (data.posts.length === 0) break;
        offset += data.posts.length;
      }
      setPosts(all);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }

  async function loadSettings() {
    try {
      const response = await fetch('/api/blog/settings', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setAutoPublishSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function loadSetOptions() {
    setLoadingSets(true);
    try {
      const response = await fetch('/api/blog/set-availability', { credentials: 'include' });
      if (response.ok) {
        const data = await response.json();
        setSetOptions(data.sets || []);
        const unprocessedSet = data.sets?.find((s: SetOption) => !s.processed);
        if (unprocessedSet) {
          setSelectedSetNumber(unprocessedSet.setNumber);
        } else if (data.sets?.length > 0) {
          setSelectedSetNumber(data.sets[data.sets.length - 1].setNumber);
        }
      }
    } catch (err) {
      console.error('Failed to load set options:', err);
    } finally {
      setLoadingSets(false);
    }
  }

  async function toggleSetting(key: string) {
    setTogglingSettings(key);
    const newValue = !autoPublishSettings[key];
    try {
      const response = await fetch('/api/blog/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value: newValue }),
      });
      if (response.ok) {
        setAutoPublishSettings(prev => ({ ...prev, [key]: newValue }));
      }
    } catch (err) {
      console.error('Failed to toggle setting:', err);
    } finally {
      setTogglingSettings(null);
    }
  }

  async function handleStatusToggle(post: BlogPost) {
    const publishing = post.status === 'draft';
    setTogglingStatus(post.id);
    try {
      const result = await updatePost(post.slug, { status: publishing ? 'published' : 'draft' });
      setPosts(prev => prev.map(p => (p.id === post.id ? { ...p, ...result.post } : p)));
      if (publishing) {
        if (result.tweet?.skipped) {
          toast('Published (tweet skipped — already posted)');
        } else if (result.tweet && !result.tweet.success) {
          toast('Published, but posting to X failed', 'error');
        } else if (result.tweet?.tweetId || result.tweet?.success) {
          toast('Published — posted to X');
        } else {
          toast('Published');
        }
      } else {
        toast('Moved to draft', 'info');
      }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update post', 'error');
    } finally {
      setTogglingStatus(null);
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(post.id);
    try {
      await deletePost(post.slug);
      setPosts(prev => prev.filter(p => p.id !== post.id));
      toast('Post deleted', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete post', 'error');
    } finally {
      setDeleting(null);
    }
  }

  async function handlePin(post: BlogPost) {
    setPinning(post.id);
    try {
      const newPinned = !post.pinned;
      await updatePost(post.slug, { pinned: newPinned });
      setPosts(prev => prev.map(p => ({
        ...p,
        pinned: p.id === post.id ? newPinned : (newPinned ? false : p.pinned),
      })));
      toast(newPinned ? 'Pinned to featured' : 'Unpinned', 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update pin status', 'error');
    } finally {
      setPinning(null);
    }
  }

  function toggleSelection(slug: string) {
    setSelectedSlugs(prev => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedSlugs.size === filteredPosts.length) {
      setSelectedSlugs(new Set());
    } else {
      setSelectedSlugs(new Set(filteredPosts.map(p => p.slug)));
    }
  }

  async function handleBulkDelete() {
    if (selectedSlugs.size === 0) return;
    if (!confirm(`Delete ${selectedSlugs.size} post${selectedSlugs.size !== 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkOperating(true);
    try {
      const slugs = Array.from(selectedSlugs);
      await Promise.all(slugs.map(slug => deletePost(slug)));
      setPosts(prev => prev.filter(p => !selectedSlugs.has(p.slug)));
      setSelectedSlugs(new Set());
      toast(`Deleted ${slugs.length} post${slugs.length !== 1 ? 's' : ''}`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to delete some posts', 'error');
    } finally {
      setBulkOperating(false);
    }
  }

  async function handleBulkStatusChange(newStatus: 'published' | 'draft') {
    if (selectedSlugs.size === 0) return;
    const n = selectedSlugs.size;
    const warning = newStatus === 'published'
      ? `Publish ${n} post${n !== 1 ? 's' : ''}? Publishing auto-posts to X — this may fire up to ${n} tweet${n !== 1 ? 's' : ''}.`
      : `Move ${n} post${n !== 1 ? 's' : ''} to draft?`;
    if (!confirm(warning)) return;
    setBulkOperating(true);
    try {
      const slugs = Array.from(selectedSlugs);
      await Promise.all(slugs.map(slug => updatePost(slug, { status: newStatus })));
      setPosts(prev => prev.map(p => (selectedSlugs.has(p.slug) ? { ...p, status: newStatus } : p)));
      setSelectedSlugs(new Set());
      toast(newStatus === 'published' ? `Published ${slugs.length} post${slugs.length !== 1 ? 's' : ''}` : `Moved ${slugs.length} to draft`, 'info');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to update some posts', 'error');
    } finally {
      setBulkOperating(false);
    }
  }

  async function triggerCron(type: string, options?: { setNumber?: number; force?: boolean }) {
    setTriggering(type);
    setTriggerResult(null);
    try {
      const body: { type: string; setNumber?: number; force?: boolean } = { type };
      if (options?.setNumber !== undefined) body.setNumber = options.setNumber;
      if (options?.force) body.force = true;
      const response = await fetch('/api/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (response.ok) {
        setTriggerResult({
          type,
          success: true,
          message: data.results?.length
            ? `Processed ${data.gamesProcessed ?? data.seriesProcessed ?? data.results.length} item(s): ${data.results.map((r: { title?: string; error?: string }) => r.title || r.error).filter(Boolean).join(', ')}`
            : data.post?.title
            ? `Created: "${data.post.title}"`
            : data.message || 'Triggered successfully',
        });
        loadPosts();
        if (type === 'set-recap') loadSetOptions();
      } else {
        setTriggerResult({ type, success: false, message: data.error || 'Failed to trigger' });
      }
    } catch (err) {
      setTriggerResult({ type, success: false, message: err instanceof Error ? err.message : 'Failed to trigger' });
    } finally {
      setTriggering(null);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Draft';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFilterTeam('all');
    setFilterStatus('all');
    setFilterType('all');
  };

  const hasFilters = search.trim() !== '' || filterTeam !== 'all' || filterStatus !== 'all' || filterType !== 'all';

  const renderExtraBadges = (post: BlogPost) => (
    <>
      {post.status === 'draft' && post.factCheck && !post.factCheck.passed && (
        <Badge variant="error" title={post.factCheck.issues.join('; ')}>Fact-check blocked</Badge>
      )}
      {post.status === 'published' && post.xPost?.error && !post.xPost?.tweetId && (
        <Badge variant="warning" title={post.xPost.error}>X failed</Badge>
      )}
    </>
  );

  const renderPostActions = (post: BlogPost, iconSize: string) => (
    <>
      <button
        onClick={() => handlePin(post)}
        disabled={pinning === post.id}
        className={`rounded p-1.5 transition-colors disabled:opacity-50 ${
          post.pinned ? 'text-amber-500 hover:text-amber-600' : 'text-gray-400 hover:text-amber-500'
        }`}
        title={post.pinned ? 'Unpin' : 'Pin to featured'}
      >
        {pinning === post.id ? <Spinner size="sm" /> : <Pin className={`${iconSize} ${post.pinned ? 'fill-current' : ''}`} />}
      </button>
      {post.status === 'published' && (
        <a
          href={`/blog/${post.team}/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-700"
          title="View"
        >
          <Eye className={iconSize} />
        </a>
      )}
      {post.status === 'published' && (
        <button
          onClick={() => setSharingPost(post)}
          className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-700"
          title="Share to X"
        >
          <Share2 className={iconSize} />
        </button>
      )}
      <Link
        href={`/admin/posts/${post.slug}`}
        className="rounded p-1.5 text-gray-400 transition-colors hover:text-gray-700"
        title="Edit"
      >
        <Edit className={iconSize} />
      </Link>
      <button
        onClick={() => handleDelete(post)}
        disabled={deleting === post.id}
        className="rounded p-1.5 text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
        title="Delete"
      >
        {deleting === post.id ? <Spinner size="sm" /> : <Trash2 className={iconSize} />}
      </button>
    </>
  );

  const renderStatusToggle = (post: BlogPost) => (
    <div className="flex items-center gap-2">
      <Toggle
        checked={post.status === 'published'}
        onChange={() => handleStatusToggle(post)}
        disabled={togglingStatus !== null}
        busy={togglingStatus === post.id}
      />
      <span className={`text-xs font-semibold ${post.status === 'published' ? 'text-green-700' : 'text-gray-400'}`}>
        {post.status === 'published' ? 'Live' : 'Draft'}
      </span>
    </div>
  );

  const automationRow = (job: (typeof AUTOMATION_JOBS)[number]) => {
    const cron = cronJobs.get(job.slug);
    return (
      <div key={job.slug} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{job.label}</p>
          {cron && (
            <p className="text-xs text-gray-500">
              {cron.humanSchedule} <span className="text-gray-400">· next {cron.nextRunLabel}</span>
            </p>
          )}
        </div>
        {job.hasSetPicker && (
          <Select
            value={selectedSetNumber ?? ''}
            onChange={(e) => setSelectedSetNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
            disabled={triggering !== null || loadingSets || setOptions.length === 0}
            className="!w-auto"
          >
            {loadingSets ? (
              <option value="">Loading...</option>
            ) : setOptions.length === 0 ? (
              <option value="">No sets</option>
            ) : (
              setOptions.map(set => (
                <option key={set.setNumber} value={set.setNumber}>
                  Set {set.setNumber} {set.processed ? '✓' : ''}
                </option>
              ))
            )}
          </Select>
        )}
        <Toggle
          checked={autoPublishSettings[job.settingKey] ?? false}
          onChange={() => toggleSetting(job.settingKey)}
          disabled={togglingSettings !== null}
          busy={togglingSettings === job.settingKey}
          label={<span className="text-xs text-gray-500">Auto-publish</span>}
        />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (job.hasSetPicker) {
              if (!selectedSetNumber) return;
              const set = setOptions.find(s => s.setNumber === selectedSetNumber);
              triggerCron(job.trigger, { setNumber: selectedSetNumber, force: set?.processed ?? false });
            } else {
              triggerCron(job.trigger);
            }
          }}
          disabled={triggering !== null || (job.hasSetPicker && !selectedSetNumber)}
        >
          {triggering === job.trigger ? <Spinner size="sm" /> : <Play className="h-3.5 w-3.5" />}
          Run now
        </Button>
      </div>
    );
  };

  return (
    <>
      <main className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader
          title="Posts"
          description={
            loading
              ? 'Loading posts…'
              : `${posts.length} post${posts.length !== 1 ? 's' : ''}${draftCount > 0 ? ` · ${draftCount} draft${draftCount !== 1 ? 's' : ''}` : ''}`
          }
          actions={
            <Button href="/admin/posts/new" variant="primary">
              <Plus className="h-4 w-4" />
              New Post
            </Button>
          }
        />

        {/* Automation — schedule parsed from vercel.json, rendered in ET */}
        <Card className="mb-6" padding={false}>
          <button
            onClick={() => setAutomationOpen(v => !v)}
            className="flex w-full items-center gap-3 p-4 text-left sm:p-5"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sabres-blue">
              <Zap className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-gray-900">Automation</span>
              <span className="block truncate text-xs text-gray-500">
                {AUTOMATION_JOBS.length} jobs
                {nextUpcoming?.cron && (
                  <> · next: {teamLabel(nextUpcoming.team)} {nextUpcoming.label} · {nextUpcoming.cron.nextRunLabel}</>
                )}
              </span>
            </span>
            {automationOpen ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />
            )}
          </button>

          {automationOpen && (
            <div className="border-t border-gray-100 px-4 pb-4 sm:px-5 sm:pb-5">
              <div className="grid gap-x-10 md:grid-cols-2">
                {(['sabres', 'bills'] as const).map(team => (
                  <div key={team}>
                    <div className="mt-4 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: teamBadgeColor(team) }} />
                      <h4 className="text-xs font-bold uppercase tracking-wide text-gray-500">{teamLabel(team)}</h4>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {AUTOMATION_JOBS.filter(j => j.team === team).map(automationRow)}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Auto-publish on: articles go live (and post to X) as soon as they generate. Off: they land here as drafts for review.
              </p>
              {triggerResult && (
                <div
                  className={`mt-3 rounded-lg p-3 text-sm ${
                    triggerResult.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                  }`}
                >
                  <strong>{AUTOMATION_JOBS.find(j => j.trigger === triggerResult.type)?.label ?? triggerResult.type}:</strong>{' '}
                  {triggerResult.message}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Bulk action bar */}
        {selectedSlugs.size > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-gray-900">
              <CheckSquare className="h-4 w-4 text-sabres-blue" />
              {selectedSlugs.size} selected
            </span>
            <Button variant="secondary" size="sm" onClick={() => handleBulkStatusChange('published')} disabled={bulkOperating}>
              {bulkOperating ? 'Working…' : 'Publish'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => handleBulkStatusChange('draft')} disabled={bulkOperating}>
              {bulkOperating ? 'Working…' : 'Set Draft'}
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={bulkOperating}>
              {bulkOperating ? 'Deleting…' : 'Delete'}
            </Button>
            <button
              onClick={() => setSelectedSlugs(new Set())}
              className="ml-auto flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              <X className="h-4 w-4" />
              Clear
            </button>
          </div>
        )}

        {/* Filters */}
        {posts.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <SearchInput
              placeholder="Search titles…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full sm:w-64"
            />
            <Select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="!w-auto">
              <option value="all">All Teams</option>
              {teamOptions.map(t => (
                <option key={t} value={t}>{teamLabel(t)}</option>
              ))}
            </Select>
            <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FilterStatus)} className="!w-auto">
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </Select>
            <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="!w-auto">
              <option value="all">All Types</option>
              {typeOptions.map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>
              ))}
            </Select>
            {hasFilters && (
              <button onClick={clearFilters} className="px-2 text-sm text-gray-500 transition-colors hover:text-gray-700">
                Clear
              </button>
            )}
            <span className="ml-auto text-sm text-gray-400">
              {filteredPosts.length} of {posts.length}
            </span>
          </div>
        )}

        {/* Posts */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <ErrorBanner>{error}</ErrorBanner>
        ) : filteredPosts.length === 0 && posts.length > 0 ? (
          <Card className="mb-8">
            <EmptyState>
              <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="mb-1 font-semibold text-gray-600">No matching posts</p>
              <p className="mb-4">Try adjusting your filters</p>
              <Button variant="secondary" onClick={clearFilters}>Clear Filters</Button>
            </EmptyState>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="mb-8">
            <EmptyState>
              <FileText className="mx-auto mb-3 h-10 w-10 text-gray-300" />
              <p className="mb-1 font-semibold text-gray-600">No posts yet</p>
              <p className="mb-4">Create your first post to get started</p>
              <Button href="/admin/posts/new" variant="primary">
                <Plus className="h-4 w-4" />
                Create First Post
              </Button>
            </EmptyState>
          </Card>
        ) : (
          <Card className="mb-4 overflow-hidden" padding={false}>
            {/* Mobile card layout */}
            <div className="divide-y divide-gray-100 md:hidden">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
                >
                  {selectedSlugs.size === filteredPosts.length && filteredPosts.length > 0 ? (
                    <CheckSquare className="h-4 w-4" />
                  ) : (
                    <Square className="h-4 w-4" />
                  )}
                  {selectedSlugs.size > 0 ? `${selectedSlugs.size} selected` : 'Select all'}
                </button>
                <span className="text-xs text-gray-400">{filteredPosts.length} posts</span>
              </div>
              {pagePosts.map(post => (
                <div key={post.id} className={`px-4 py-3 ${selectedSlugs.has(post.slug) ? 'bg-blue-50/60' : ''}`}>
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelection(post.slug)}
                      className="mt-0.5 shrink-0 text-gray-400 transition-colors hover:text-gray-600"
                    >
                      {selectedSlugs.has(post.slug) ? (
                        <CheckSquare className="h-4 w-4 text-sabres-blue" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/admin/posts/${post.slug}`}
                        className="block text-sm font-medium leading-snug text-gray-900 transition-colors hover:text-sabres-blue"
                      >
                        {post.title}
                      </Link>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge className="uppercase" style={{ backgroundColor: teamBadgeColor(post.team), color: '#fff' }}>
                          {post.team}
                        </Badge>
                        <Badge variant="info">{TYPE_LABELS[post.type] ?? post.type}</Badge>
                        {post.pinned && <Badge variant="warning">Pinned</Badge>}
                        {renderExtraBadges(post)}
                        <span className="text-xs text-gray-400">{post.views?.toLocaleString() ?? '0'} views</span>
                      </div>
                      <p className="mt-1.5 text-xs text-gray-400">{formatDate(post.publishedAt || post.createdAt)}</p>
                      <div className="mt-2 flex items-center justify-between">
                        {renderStatusToggle(post)}
                        <div className="flex items-center gap-1">{renderPostActions(post, 'h-3.5 w-3.5')}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    <Th className="w-12">
                      <button
                        onClick={toggleSelectAll}
                        className="text-gray-400 transition-colors hover:text-gray-600"
                        title={selectedSlugs.size === filteredPosts.length ? 'Deselect all' : 'Select all'}
                      >
                        {selectedSlugs.size === filteredPosts.length && filteredPosts.length > 0 ? (
                          <CheckSquare className="h-4 w-4" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </button>
                    </Th>
                    <Th>Title</Th>
                    <Th>Team</Th>
                    <Th>Type</Th>
                    <Th
                      sort={{
                        direction: sortField === 'views' ? sortDirection : null,
                        onClick: () => {
                          if (sortField === 'views') setSortDirection(d => (d === 'desc' ? 'asc' : 'desc'));
                          else { setSortField('views'); setSortDirection('desc'); }
                        },
                      }}
                    >
                      Views
                    </Th>
                    <Th
                      className="hidden lg:table-cell"
                      sort={{
                        direction: sortField === 'date' ? sortDirection : null,
                        onClick: () => {
                          if (sortField === 'date') setSortDirection(d => (d === 'desc' ? 'asc' : 'desc'));
                          else { setSortField('date'); setSortDirection('desc'); }
                        },
                      }}
                    >
                      Date
                    </Th>
                    <Th>Published</Th>
                    <Th align="right">Actions</Th>
                  </tr>
                </thead>
                <tbody>
                  {pagePosts.map(post => (
                    <tr
                      key={post.id}
                      className={`transition-colors hover:bg-gray-50 ${selectedSlugs.has(post.slug) ? 'bg-blue-50/60' : ''}`}
                    >
                      <Td className="w-12">
                        <button
                          onClick={() => toggleSelection(post.slug)}
                          className="text-gray-400 transition-colors hover:text-gray-600"
                        >
                          {selectedSlugs.has(post.slug) ? (
                            <CheckSquare className="h-4 w-4 text-sabres-blue" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </Td>
                      <Td className="max-w-md">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/posts/${post.slug}`}
                            className="truncate font-medium text-gray-900 transition-colors hover:text-sabres-blue"
                            title={post.title}
                          >
                            {post.title}
                          </Link>
                          {post.pinned && <Badge variant="warning" className="shrink-0">Pinned</Badge>}
                          {renderExtraBadges(post)}
                        </div>
                      </Td>
                      <Td>
                        <Badge className="uppercase" style={{ backgroundColor: teamBadgeColor(post.team), color: '#fff' }}>
                          {post.team}
                        </Badge>
                      </Td>
                      <Td>
                        <Badge variant="info">{TYPE_LABELS[post.type] ?? post.type}</Badge>
                      </Td>
                      <Td className="text-gray-500">{post.views?.toLocaleString() ?? '0'}</Td>
                      <Td className="hidden whitespace-nowrap text-gray-500 lg:table-cell">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </Td>
                      <Td>{renderStatusToggle(post)}</Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-0.5">{renderPostActions(post, 'h-4 w-4')}</div>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        )}

        {/* Pagination */}
        {!loading && !error && pageCount > 1 && (
          <div className="mb-8 flex items-center justify-between">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={currentPage === 0}
            >
              Previous
            </Button>
            <span className="text-sm text-gray-500">
              Page {currentPage + 1} of {pageCount}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
              disabled={currentPage >= pageCount - 1}
            >
              Next
            </Button>
          </div>
        )}
      </main>

      {sharingPost && <ShareToXModal post={sharingPost} onClose={() => setSharingPost(null)} />}
    </>
  );
}
