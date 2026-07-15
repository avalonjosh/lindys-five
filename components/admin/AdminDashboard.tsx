'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Eye, FileText, Newspaper, Calendar, Trophy, Layers, Pin, ChevronUp, ChevronDown, Filter, Clock, CheckSquare, Square, X, Share2 } from 'lucide-react';
import { fetchPosts, deletePost, updatePost } from '@/lib/services/blogApi';
import ShareToXModal from './ShareToXModal';
import { Card, SectionHeading, Button, Toggle, Badge, Spinner } from './ui';
import type { BlogPost } from '@/lib/types';

type FilterTeam = 'all' | 'sabres' | 'bills';
type FilterStatus = 'all' | 'published' | 'draft';
type FilterType = 'all' | 'game-recap' | 'set-recap' | 'news-analysis' | 'weekly-roundup' | 'custom' | 'playoff-game-recap' | 'series-recap';
type SortDirection = 'desc' | 'asc';
type SortField = 'date' | 'views';

interface SetOption {
  setNumber: number;
  processed: boolean;
  startDate: string;
  endDate: string;
}

type AutoPublishSettings = {
  // Sabres
  'auto-publish-weekly': boolean;
  'auto-publish-news': boolean;
  'auto-publish-game-recap': boolean;
  'auto-publish-set-recap': boolean;
  'auto-publish-playoff-game-recap': boolean;
  'auto-publish-series-recap': boolean;
  // Bills
  'auto-publish-bills-news': boolean;
  'auto-publish-bills-weekly': boolean;
  'auto-publish-bills-game-recap': boolean;
};

const TYPE_LABELS: Record<string, string> = {
  'game-recap': 'Game Recap',
  'playoff-game-recap': 'Playoff Recap',
  'series-recap': 'Series Recap',
  'set-recap': 'Set Recap',
  'news-analysis': 'News',
  'weekly-roundup': 'Weekly',
  custom: 'Custom',
};

const TRIGGER_LABELS: Record<string, string> = {
  weekly: 'Weekly Roundup',
  news: 'News Scan',
  'set-recap': 'Set Recap',
  'game-recap': 'Game Recap',
  'playoff-game-recap': 'Playoff Game Recap',
  'series-recap': 'Series Recap',
  'bills-news': 'Bills News Scan',
  'bills-weekly': 'Bills Weekly Roundup',
  'bills-game-recap': 'Bills Game Recap',
};

function teamBadgeColor(team: string) {
  if (team === 'sabres') return '#003087';
  if (team === 'bills') return '#C60C30';
  return '#475569';
}

export default function AdminDashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ type: string; success: boolean; message: string } | null>(null);
  const [autoPublishSettings, setAutoPublishSettings] = useState<AutoPublishSettings>({
    // Sabres
    'auto-publish-weekly': false,
    'auto-publish-news': false,
    'auto-publish-game-recap': false,
    'auto-publish-set-recap': false,
    'auto-publish-playoff-game-recap': false,
    'auto-publish-series-recap': false,
    // Bills
    'auto-publish-bills-news': false,
    'auto-publish-bills-weekly': false,
    'auto-publish-bills-game-recap': false,
  });
  const [togglingSettings, setTogglingSettings] = useState<string | null>(null);
  const [pinning, setPinning] = useState<string | null>(null);
  const [sharingPost, setSharingPost] = useState<BlogPost | null>(null);
  const [selectedSlugs, setSelectedSlugs] = useState<Set<string>>(new Set());
  const [bulkOperating, setBulkOperating] = useState(false);
  const [filterTeam, setFilterTeam] = useState<FilterTeam>('all');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [sortField, setSortField] = useState<SortField>('date');
  const [showSchedule, setShowSchedule] = useState(false);
  const [setOptions, setSetOptions] = useState<SetOption[]>([]);
  const [selectedSetNumber, setSelectedSetNumber] = useState<number | null>(null);
  const [loadingSets, setLoadingSets] = useState(false);
  const router = useRouter();

  // Filter and sort posts
  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Apply filters
    if (filterTeam !== 'all') {
      result = result.filter(p => p.team === filterTeam);
    }
    if (filterStatus !== 'all') {
      result = result.filter(p => p.status === filterStatus);
    }
    if (filterType !== 'all') {
      result = result.filter(p => p.type === filterType);
    }

    // Apply sort
    result.sort((a, b) => {
      if (sortField === 'views') {
        const viewsA = a.views ?? 0;
        const viewsB = b.views ?? 0;
        return sortDirection === 'desc' ? viewsB - viewsA : viewsA - viewsB;
      }
      const dateA = new Date(a.publishedAt || a.createdAt).getTime();
      const dateB = new Date(b.publishedAt || b.createdAt).getTime();
      return sortDirection === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [posts, filterTeam, filterStatus, filterType, sortDirection, sortField]);

  useEffect(() => {
    loadPosts();
    loadSettings();
    loadSetOptions();
  }, []);

  async function loadSetOptions() {
    setLoadingSets(true);
    try {
      const response = await fetch('/api/blog/set-availability', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSetOptions(data.sets || []);
        // Default to latest unprocessed set, or latest set if all processed
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

  async function loadSettings() {
    try {
      const response = await fetch('/api/blog/settings');
      if (response.ok) {
        const data = await response.json();
        setAutoPublishSettings(data.settings);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  }

  async function toggleSetting(key: keyof AutoPublishSettings) {
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
        setAutoPublishSettings((prev) => ({ ...prev, [key]: newValue }));
      }
    } catch (err) {
      console.error('Failed to toggle setting:', err);
    } finally {
      setTogglingSettings(null);
    }
  }

  async function loadPosts() {
    try {
      setLoading(true);
      // Fetch all posts including drafts (admin view)
      const data = await fetchPosts({ limit: 100 });
      setPosts(data.posts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(post: BlogPost) {
    if (!confirm(`Delete "${post.title}"? This cannot be undone.`)) {
      return;
    }

    setDeleting(post.id);
    try {
      await deletePost(post.slug);
      setPosts(posts.filter((p) => p.id !== post.id));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete post');
    } finally {
      setDeleting(null);
    }
  }

  async function handlePin(post: BlogPost) {
    setPinning(post.id);
    try {
      const newPinned = !post.pinned;
      await updatePost(post.slug, { pinned: newPinned });
      // Update local state - if pinning, unpin all others
      setPosts(posts.map((p) => ({
        ...p,
        pinned: p.id === post.id ? newPinned : (newPinned ? false : p.pinned)
      })));
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update pin status');
    } finally {
      setPinning(null);
    }
  }

  function toggleSelection(slug: string) {
    setSelectedSlugs(prev => {
      const next = new Set(prev);
      if (next.has(slug)) {
        next.delete(slug);
      } else {
        next.add(slug);
      }
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
    if (!confirm(`Delete ${selectedSlugs.size} post${selectedSlugs.size !== 1 ? 's' : ''}? This cannot be undone.`)) {
      return;
    }

    setBulkOperating(true);
    try {
      const slugsToDelete = Array.from(selectedSlugs);
      await Promise.all(slugsToDelete.map(slug => deletePost(slug)));
      setPosts(posts.filter(p => !selectedSlugs.has(p.slug)));
      setSelectedSlugs(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete some posts');
    } finally {
      setBulkOperating(false);
    }
  }

  async function handleBulkStatusChange(newStatus: 'published' | 'draft') {
    if (selectedSlugs.size === 0) return;
    if (!confirm(`Change ${selectedSlugs.size} post${selectedSlugs.size !== 1 ? 's' : ''} to ${newStatus}?`)) {
      return;
    }

    setBulkOperating(true);
    try {
      const slugsToUpdate = Array.from(selectedSlugs);
      await Promise.all(slugsToUpdate.map(slug => updatePost(slug, { status: newStatus })));
      setPosts(posts.map(p => selectedSlugs.has(p.slug) ? { ...p, status: newStatus } : p));
      setSelectedSlugs(new Set());
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update some posts');
    } finally {
      setBulkOperating(false);
    }
  }

  async function triggerCron(
    type: 'weekly' | 'news' | 'game-recap' | 'set-recap' | 'playoff-game-recap' | 'series-recap' | 'bills-news' | 'bills-weekly' | 'bills-game-recap',
    options?: { setNumber?: number; force?: boolean }
  ) {
    setTriggering(type);
    setTriggerResult(null);
    try {
      const body: { type: string; setNumber?: number; force?: boolean } = { type };
      if (options?.setNumber !== undefined) {
        body.setNumber = options.setNumber;
      }
      if (options?.force) {
        body.force = true;
      }
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
        // Reload posts to show any new ones
        loadPosts();
        // Reload set options if we just generated a set recap
        if (type === 'set-recap') {
          loadSetOptions();
        }
      } else {
        setTriggerResult({
          type,
          success: false,
          message: data.error || 'Failed to trigger',
        });
      }
    } catch (err) {
      setTriggerResult({
        type,
        success: false,
        message: err instanceof Error ? err.message : 'Failed to trigger',
      });
    } finally {
      setTriggering(null);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Draft';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const triggerResultBanner = triggerResult && (
    <div
      className={`mt-4 p-3 rounded-lg text-sm ${
        triggerResult.success ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'
      }`}
    >
      <strong>{TRIGGER_LABELS[triggerResult.type] ?? triggerResult.type}:</strong>{' '}
      {triggerResult.message}
    </div>
  );

  const isBillsTrigger = triggerResult?.type.startsWith('bills-') ?? false;

  const clearFilters = () => {
    setFilterTeam('all');
    setFilterStatus('all');
    setFilterType('all');
  };

  const renderPostBadges = (post: BlogPost) => (
    <>
      <Badge variant={post.status === 'published' ? 'success' : 'warning'} className="capitalize">
        {post.status}
      </Badge>
      {post.status === 'draft' && post.factCheck && !post.factCheck.passed && (
        <Badge variant="error" title={post.factCheck.issues.join('; ')}>
          Fact-check blocked
        </Badge>
      )}
      {post.status === 'published' && post.xPost?.error && !post.xPost?.tweetId && (
        <Badge variant="warning" title={post.xPost.error} className="!bg-orange-600/30 !text-orange-400">
          X failed
        </Badge>
      )}
      {post.pinned && <Badge variant="warning">Pinned</Badge>}
    </>
  );

  const renderPostActions = (post: BlogPost, iconSize: string) => (
    <>
      <button
        onClick={() => handlePin(post)}
        disabled={pinning === post.id}
        className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
          post.pinned ? 'text-amber-400 hover:text-amber-300' : 'text-slate-400 hover:text-amber-400'
        }`}
        title={post.pinned ? 'Unpin' : 'Pin to featured'}
      >
        {pinning === post.id ? (
          <Spinner size="sm" />
        ) : (
          <Pin className={`${iconSize} ${post.pinned ? 'fill-current' : ''}`} />
        )}
      </button>
      {post.status === 'published' && (
        <a
          href={`/blog/${post.team}/${post.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
          title="View"
        >
          <Eye className={iconSize} />
        </a>
      )}
      {post.status === 'published' && (
        <button
          onClick={() => setSharingPost(post)}
          className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
          title="Share to X"
        >
          <Share2 className={iconSize} />
        </button>
      )}
      <Link
        href={`/admin/posts/${post.slug}`}
        className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
        title="Edit"
      >
        <Edit className={iconSize} />
      </Link>
      <button
        onClick={() => handleDelete(post)}
        disabled={deleting === post.id}
        className="p-1.5 rounded text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
        title="Delete"
      >
        {deleting === post.id ? <Spinner size="sm" /> : <Trash2 className={iconSize} />}
      </button>
    </>
  );

  const selectClasses =
    'px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-sabres-gold';

  return (
    <>
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="font-display text-3xl text-white tracking-wide">Posts</h2>
            <p className="text-slate-400 text-sm mt-1">
              {posts.length} post{posts.length !== 1 ? 's' : ''} total
            </p>
          </div>
          <Link
            href="/admin/posts/new"
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold bg-sabres-gold hover:brightness-110 text-black transition-colors"
          >
            <Plus className="w-5 h-5" />
            New Post
          </Link>
        </div>

        {/* Bulk Action Bar */}
        {selectedSlugs.size > 0 && (
          <div className="mb-6 p-4 bg-sabres-gold/10 border border-sabres-gold/50 rounded-xl flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 text-white">
              <CheckSquare className="w-5 h-5 text-sabres-gold" />
              <span className="font-semibold">{selectedSlugs.size} selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleBulkStatusChange('published')}
                disabled={bulkOperating}
              >
                {bulkOperating ? 'Working...' : 'Publish'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleBulkStatusChange('draft')}
                disabled={bulkOperating}
              >
                {bulkOperating ? 'Working...' : 'Set Draft'}
              </Button>
              <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={bulkOperating}>
                {bulkOperating ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
            <button
              onClick={() => setSelectedSlugs(new Set())}
              className="ml-auto text-slate-400 hover:text-white transition-colors flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear selection
            </button>
          </div>
        )}

        {/* Filters */}
        {posts.length > 0 && (
          <Card className="mb-6 flex flex-wrap items-center gap-4 p-4" padding={false}>
            <div className="flex items-center gap-2 text-slate-400">
              <Filter className="w-4 h-4" />
              <span className="text-sm font-medium">Filters:</span>
            </div>
            <select
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value as FilterTeam)}
              className={selectClasses}
            >
              <option value="all">All Teams</option>
              <option value="sabres">Sabres</option>
              <option value="bills">Bills</option>
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
              className={selectClasses}
            >
              <option value="all">All Status</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as FilterType)}
              className={selectClasses}
            >
              <option value="all">All Types</option>
              <option value="game-recap">Game Recap</option>
              <option value="playoff-game-recap">Playoff Game Recap</option>
              <option value="series-recap">Series Recap</option>
              <option value="set-recap">Set Recap</option>
              <option value="news-analysis">News</option>
              <option value="weekly-roundup">Weekly Roundup</option>
              <option value="custom">Custom</option>
            </select>
            {(filterTeam !== 'all' || filterStatus !== 'all' || filterType !== 'all') && (
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
              >
                Clear filters
              </button>
            )}
            <span className="ml-auto text-slate-400 text-sm">
              {filteredPosts.length} of {posts.length} posts
            </span>
          </Card>
        )}

        {/* Posts list */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-16">
            <p className="text-red-400">{error}</p>
          </div>
        ) : filteredPosts.length === 0 && posts.length > 0 ? (
          <Card className="text-center py-16 mb-8">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="font-display text-slate-300 text-2xl mb-2">No Matching Posts</p>
            <p className="text-slate-400 text-sm mb-6">Try adjusting your filters</p>
            <Button variant="ghost" onClick={clearFilters}>
              Clear Filters
            </Button>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="text-center py-16 mb-8">
            <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
            <p className="font-display text-slate-300 text-2xl mb-2">No Posts Yet</p>
            <p className="text-slate-400 text-sm mb-6">Create your first post to get started</p>
            <Link
              href="/admin/posts/new"
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-semibold bg-sabres-gold hover:brightness-110 text-black transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create First Post
            </Link>
          </Card>
        ) : (
          <Card className="overflow-hidden mb-8" padding={false}>
            {/* Mobile card layout */}
            <div className="md:hidden divide-y divide-slate-700">
              <div className="bg-slate-900/50 px-4 py-3 flex items-center justify-between">
                <button
                  onClick={toggleSelectAll}
                  className="text-slate-400 hover:text-white transition-colors flex items-center gap-2 text-sm"
                >
                  {selectedSlugs.size === filteredPosts.length && filteredPosts.length > 0 ? (
                    <CheckSquare className="w-4 h-4" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                  {selectedSlugs.size > 0 ? `${selectedSlugs.size} selected` : 'Select all'}
                </button>
                <span className="text-slate-400 text-xs">{filteredPosts.length} posts</span>
              </div>
              {filteredPosts.map((post) => (
                <div
                  key={post.id}
                  className={`px-4 py-3 ${selectedSlugs.has(post.slug) ? 'bg-slate-700/40' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <button
                      onClick={() => toggleSelection(post.slug)}
                      className="text-slate-400 hover:text-white transition-colors mt-0.5 shrink-0"
                    >
                      {selectedSlugs.has(post.slug) ? (
                        <CheckSquare className="w-4 h-4 text-sabres-gold" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/admin/posts/${post.slug}`}
                        className="text-white font-medium hover:text-sabres-gold transition-colors text-sm leading-snug block"
                      >
                        {post.title}
                      </Link>
                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                        <Badge
                          className="uppercase"
                          style={{ backgroundColor: teamBadgeColor(post.team), color: '#fff' }}
                        >
                          {post.team}
                        </Badge>
                        <Badge variant="info">{TYPE_LABELS[post.type] ?? post.type}</Badge>
                        {renderPostBadges(post)}
                        <span className="text-slate-500 text-xs">
                          {post.views?.toLocaleString() ?? '0'} views
                        </span>
                      </div>
                      <p className="text-slate-500 text-xs mt-1.5">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </p>
                      <div className="flex items-center gap-1 mt-2">
                        {renderPostActions(post, 'w-3.5 h-3.5')}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <table className="w-full hidden md:table">
              <thead>
                <tr className="bg-slate-900/50">
                  <th className="w-12 px-4 py-3">
                    <button
                      onClick={toggleSelectAll}
                      className="text-slate-400 hover:text-white transition-colors"
                      title={selectedSlugs.size === filteredPosts.length ? 'Deselect all' : 'Select all'}
                    >
                      {selectedSlugs.size === filteredPosts.length && filteredPosts.length > 0 ? (
                        <CheckSquare className="w-5 h-5" />
                      ) : (
                        <Square className="w-5 h-5" />
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Title
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Team
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Type
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    <button
                      onClick={() => {
                        if (sortField === 'views') {
                          setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortField('views');
                          setSortDirection('desc');
                        }
                      }}
                      className="flex items-center gap-1 hover:text-white transition-colors uppercase tracking-wider"
                    >
                      Views
                      {sortField === 'views' && (
                        sortDirection === 'desc' ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold hidden lg:table-cell">
                    <button
                      onClick={() => {
                        if (sortField === 'date') {
                          setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                        } else {
                          setSortField('date');
                          setSortDirection('desc');
                        }
                      }}
                      className="flex items-center gap-1 hover:text-white transition-colors uppercase tracking-wider"
                    >
                      Date
                      {sortField === 'date' && (
                        sortDirection === 'desc' ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronUp className="w-4 h-4" />
                        )
                      )}
                    </button>
                  </th>
                  <th className="text-right px-4 py-3 text-slate-400 text-xs uppercase tracking-wider font-semibold">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filteredPosts.map((post) => (
                  <tr
                    key={post.id}
                    className={`hover:bg-slate-700/40 transition-colors ${
                      selectedSlugs.has(post.slug) ? 'bg-slate-700/30' : ''
                    }`}
                  >
                    <td className="w-12 px-4 py-3">
                      <button
                        onClick={() => toggleSelection(post.slug)}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {selectedSlugs.has(post.slug) ? (
                          <CheckSquare className="w-5 h-5 text-sabres-gold" />
                        ) : (
                          <Square className="w-5 h-5" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/posts/${post.slug}`}
                          className="text-white font-medium hover:text-sabres-gold transition-colors"
                        >
                          {post.title}
                        </Link>
                        {post.pinned && (
                          <Badge variant="warning" className="shrink-0">
                            Pinned
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className="uppercase"
                        style={{ backgroundColor: teamBadgeColor(post.team), color: '#fff' }}
                      >
                        {post.team}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="info">{TYPE_LABELS[post.type] ?? post.type}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={post.status === 'published' ? 'success' : 'warning'} className="capitalize">
                          {post.status}
                        </Badge>
                        {post.status === 'draft' && post.factCheck && !post.factCheck.passed && (
                          <Badge variant="error" title={post.factCheck.issues.join('; ')}>
                            Fact-check blocked
                          </Badge>
                        )}
                        {post.status === 'published' && post.xPost?.error && !post.xPost?.tweetId && (
                          <Badge variant="warning" title={post.xPost.error} className="!bg-orange-600/30 !text-orange-400">
                            X failed
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm">
                      {post.views?.toLocaleString() ?? '0'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-sm hidden lg:table-cell">
                      {formatDate(post.publishedAt || post.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {renderPostActions(post, 'w-4 h-4')}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}

        {/* Automation */}
        <Card className="mb-8">
          {/* Sabres group */}
          <SectionHeading accent="#FFB81C">Sabres Automation</SectionHeading>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => triggerCron('weekly')} disabled={triggering !== null}>
              {triggering === 'weekly' ? <Spinner size="sm" /> : <Calendar className="w-4 h-4" />}
              Generate Weekly Roundup
            </Button>
            <Button variant="secondary" onClick={() => triggerCron('news')} disabled={triggering !== null}>
              {triggering === 'news' ? <Spinner size="sm" /> : <Newspaper className="w-4 h-4" />}
              Scan for News
            </Button>
            <Button variant="secondary" onClick={() => triggerCron('game-recap')} disabled={triggering !== null}>
              {triggering === 'game-recap' ? <Spinner size="sm" /> : <Trophy className="w-4 h-4" />}
              Generate Game Recaps
            </Button>
            {/* Set Recap with Dropdown */}
            <div className="flex items-center gap-2">
              <select
                value={selectedSetNumber ?? ''}
                onChange={(e) => setSelectedSetNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
                disabled={triggering !== null || loadingSets || setOptions.length === 0}
                className="px-3 py-2 bg-slate-900 border border-slate-600 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400 disabled:opacity-50"
              >
                {loadingSets ? (
                  <option value="">Loading...</option>
                ) : setOptions.length === 0 ? (
                  <option value="">No sets available</option>
                ) : (
                  setOptions.map((set) => (
                    <option key={set.setNumber} value={set.setNumber}>
                      Set {set.setNumber} {set.processed ? '✓' : ''}
                    </option>
                  ))
                )}
              </select>
              <Button
                variant="secondary"
                onClick={() => {
                  if (selectedSetNumber) {
                    const set = setOptions.find(s => s.setNumber === selectedSetNumber);
                    triggerCron('set-recap', {
                      setNumber: selectedSetNumber,
                      force: set?.processed ?? false
                    });
                  }
                }}
                disabled={triggering !== null || !selectedSetNumber}
              >
                {triggering === 'set-recap' ? <Spinner size="sm" /> : <Layers className="w-4 h-4" />}
                Generate Set Recap
              </Button>
            </div>
            <Button variant="secondary" onClick={() => triggerCron('playoff-game-recap')} disabled={triggering !== null}>
              {triggering === 'playoff-game-recap' ? <Spinner size="sm" /> : <Trophy className="w-4 h-4" />}
              Generate Playoff Recaps
            </Button>
            <Button variant="secondary" onClick={() => triggerCron('series-recap')} disabled={triggering !== null}>
              {triggering === 'series-recap' ? <Spinner size="sm" /> : <Layers className="w-4 h-4" />}
              Generate Series Recaps
            </Button>
          </div>
          {!isBillsTrigger && triggerResultBanner}

          {/* Sabres auto-publish toggles */}
          <div className="mt-6 pt-4 border-t border-slate-700">
            <p className="text-slate-300 text-sm mb-3">Auto-publish settings:</p>
            <div className="flex flex-wrap gap-6">
              <Toggle
                checked={autoPublishSettings['auto-publish-weekly']}
                onChange={() => toggleSetting('auto-publish-weekly')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-weekly'}
                label="Weekly Roundup"
              />
              <Toggle
                checked={autoPublishSettings['auto-publish-news']}
                onChange={() => toggleSetting('auto-publish-news')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-news'}
                label="News Scan"
              />
              <Toggle
                checked={autoPublishSettings['auto-publish-game-recap']}
                onChange={() => toggleSetting('auto-publish-game-recap')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-game-recap'}
                label="Game Recaps"
              />
              <Toggle
                checked={autoPublishSettings['auto-publish-set-recap']}
                onChange={() => toggleSetting('auto-publish-set-recap')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-set-recap'}
                label="Set Recaps"
              />
              <Toggle
                checked={autoPublishSettings['auto-publish-playoff-game-recap']}
                onChange={() => toggleSetting('auto-publish-playoff-game-recap')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-playoff-game-recap'}
                label="Playoff Game Recaps"
              />
              <Toggle
                checked={autoPublishSettings['auto-publish-series-recap']}
                onChange={() => toggleSetting('auto-publish-series-recap')}
                disabled={togglingSettings !== null}
                busy={togglingSettings === 'auto-publish-series-recap'}
                label="Series Recaps"
              />
            </div>
            <p className="text-slate-400 text-xs mt-2">
              Toggle on to auto-publish articles. Toggle off to create as drafts for review.
            </p>
          </div>

          {/* Bills group */}
          <div className="mt-8">
            <SectionHeading accent="#C60C30">Bills Automation</SectionHeading>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => triggerCron('bills-news')} disabled={triggering !== null}>
                {triggering === 'bills-news' ? <Spinner size="sm" /> : <Newspaper className="w-4 h-4" />}
                Scan for Bills News
              </Button>
              <Button variant="secondary" onClick={() => triggerCron('bills-weekly')} disabled={triggering !== null}>
                {triggering === 'bills-weekly' ? <Spinner size="sm" /> : <Calendar className="w-4 h-4" />}
                Generate Bills Weekly Roundup
              </Button>
              <Button variant="secondary" onClick={() => triggerCron('bills-game-recap')} disabled={triggering !== null}>
                {triggering === 'bills-game-recap' ? <Spinner size="sm" /> : <Trophy className="w-4 h-4" />}
                Generate Bills Game Recaps
              </Button>
            </div>
            {isBillsTrigger && triggerResultBanner}

            {/* Bills auto-publish toggles */}
            <div className="mt-6 pt-4 border-t border-slate-700">
              <p className="text-slate-300 text-sm mb-3">Bills auto-publish settings:</p>
              <div className="flex flex-wrap gap-6">
                <Toggle
                  checked={autoPublishSettings['auto-publish-bills-news']}
                  onChange={() => toggleSetting('auto-publish-bills-news')}
                  disabled={togglingSettings !== null}
                  busy={togglingSettings === 'auto-publish-bills-news'}
                  label="News Scan"
                />
                <Toggle
                  checked={autoPublishSettings['auto-publish-bills-weekly']}
                  onChange={() => toggleSetting('auto-publish-bills-weekly')}
                  disabled={togglingSettings !== null}
                  busy={togglingSettings === 'auto-publish-bills-weekly'}
                  label="Weekly Roundup"
                />
                <Toggle
                  checked={autoPublishSettings['auto-publish-bills-game-recap']}
                  onChange={() => toggleSetting('auto-publish-bills-game-recap')}
                  disabled={togglingSettings !== null}
                  busy={togglingSettings === 'auto-publish-bills-game-recap'}
                  label="Game Recaps"
                />
              </div>
              <p className="text-slate-400 text-xs mt-2">
                Toggle on to auto-publish Bills articles. Toggle off to create as drafts for review.
              </p>
            </div>
          </div>
        </Card>

        {/* Schedule Reference */}
        <div className="mb-8">
          <button
            onClick={() => setShowSchedule(!showSchedule)}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-2"
          >
            <Clock className="w-4 h-4" />
            <span>Automation Schedule Reference</span>
            {showSchedule ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showSchedule && (
            <Card>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Sabres Schedule */}
                <div>
                  <h4 className="text-sm font-semibold text-sabres-gold mb-3">Sabres</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weekly Roundup</span>
                      <span className="text-slate-300">Mondays ~5-6 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">News Scan</span>
                      <span className="text-slate-300">Tue/Fri ~6 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Game Recap</span>
                      <span className="text-slate-300">Daily ~11 PM-12 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Set Recap</span>
                      <span className="text-slate-300">Sundays ~7 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Playoff Game Recap</span>
                      <span className="text-slate-300">Daily ~11 PM-12 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Series Recap</span>
                      <span className="text-slate-300">Daily ~8 AM</span>
                    </div>
                  </div>
                </div>
                {/* Bills Schedule */}
                <div>
                  <h4 className="text-sm font-semibold text-[#C60C30] mb-3">Bills</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Weekly Roundup</span>
                      <span className="text-slate-300">Mondays ~5-6 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">News Scan</span>
                      <span className="text-slate-300">Tue/Fri ~6 AM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Game Recap</span>
                      <span className="text-slate-300">Mondays ~12 AM & ~5 AM</span>
                    </div>
                  </div>
                </div>
              </div>
              <p className="text-slate-500 text-xs mt-4 text-center">
                All times approximate Eastern. Cron jobs run on Vercel&apos;s schedule.
              </p>
            </Card>
          )}
        </div>
      </main>

      {/* Share to X Modal */}
      {sharingPost && (
        <ShareToXModal
          post={sharingPost}
          onClose={() => setSharingPost(null)}
        />
      )}
    </>
  );
}
