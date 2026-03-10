'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, Edit, Trash2, Eye, FileText, RefreshCw, Newspaper, Calendar, Trophy, Layers, Pin, ChevronUp, ChevronDown, Filter, Clock, CheckSquare, Square, X, Share2 } from 'lucide-react';
import AdminNav from './AdminNav';
import { fetchPosts, deletePost, updatePost } from '@/lib/services/blogApi';
import ShareToXModal from './ShareToXModal';
import type { BlogPost } from '@/lib/types';

type FilterTeam = 'all' | 'sabres' | 'bills';
type FilterStatus = 'all' | 'published' | 'draft';
type FilterType = 'all' | 'game-recap' | 'set-recap' | 'news-analysis' | 'weekly-roundup' | 'custom';
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
  // Bills
  'auto-publish-bills-news': boolean;
  'auto-publish-bills-weekly': boolean;
  'auto-publish-bills-game-recap': boolean;
};

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
    type: 'weekly' | 'news' | 'game-recap' | 'set-recap' | 'bills-news' | 'bills-weekly' | 'bills-game-recap',
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
            ? `Processed ${data.gamesProcessed} game(s): ${data.results.map((r: { title?: string }) => r.title).filter(Boolean).join(', ')}`
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

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800">
        <AdminNav activeTab="posts" />

        <main className="max-w-7xl mx-auto px-4 py-8">
          {/* Actions */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="text-3xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Posts
              </h2>
              <p className="text-slate-400 text-sm mt-1">
                {posts.length} post{posts.length !== 1 ? 's' : ''} total
              </p>
            </div>
            <Link
              href="/admin/posts/new"
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-black shadow-lg transition-all duration-300 hover:scale-105"
              style={{ backgroundColor: '#FCB514' }}
            >
              <Plus className="w-5 h-5" />
              New Post
            </Link>
          </div>

          {/* Sabres Automation Controls */}
          <div className="mb-8 p-6 bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl">
            <h3
              className="text-2xl font-semibold text-white mb-4 pb-2 border-b border-[#FCB514]/30"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Sabres Automation
            </h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => triggerCron('weekly')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'weekly' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                Generate Weekly Roundup
              </button>
              <button
                onClick={() => triggerCron('news')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'news' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Newspaper className="w-4 h-4" />
                )}
                Scan for News
              </button>
              <button
                onClick={() => triggerCron('game-recap')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'game-recap' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trophy className="w-4 h-4" />
                )}
                Generate Game Recaps
              </button>
              {/* Set Recap with Dropdown */}
              <div className="flex items-center gap-2">
                <select
                  value={selectedSetNumber ?? ''}
                  onChange={(e) => setSelectedSetNumber(e.target.value ? parseInt(e.target.value, 10) : null)}
                  disabled={triggering !== null || loadingSets || setOptions.length === 0}
                  className="px-3 py-2 bg-slate-700 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:border-indigo-400 disabled:opacity-50"
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
                <button
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
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {triggering === 'set-recap' ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Layers className="w-4 h-4" />
                  )}
                  Generate Set Recap
                </button>
              </div>
            </div>
            {triggerResult && (
              <div
                className={`mt-4 p-3 rounded-lg text-sm ${
                  triggerResult.success
                    ? 'bg-green-900/30 text-green-400'
                    : 'bg-red-900/30 text-red-400'
                }`}
              >
                <strong>{
                  triggerResult.type === 'weekly' ? 'Weekly Roundup' :
                  triggerResult.type === 'news' ? 'News Scan' :
                  triggerResult.type === 'set-recap' ? 'Set Recap' :
                  triggerResult.type === 'game-recap' ? 'Game Recap' :
                  triggerResult.type === 'bills-news' ? 'Bills News Scan' :
                  triggerResult.type === 'bills-weekly' ? 'Bills Weekly Roundup' :
                  triggerResult.type === 'bills-game-recap' ? 'Bills Game Recap' :
                  triggerResult.type
                }:</strong>{' '}
                {triggerResult.message}
              </div>
            )}

            {/* Auto-publish toggles */}
            <div className="mt-6 pt-4 border-t border-slate-500">
              <p className="text-slate-300 text-sm mb-3">Auto-publish settings:</p>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-weekly')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-weekly'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-weekly' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-weekly'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">Weekly Roundup</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-news')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-news'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-news' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-news'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">News Scan</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-game-recap')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-game-recap'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-game-recap' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-game-recap'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">Game Recaps</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-set-recap')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-set-recap'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-set-recap' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-set-recap'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">Set Recaps</span>
                </label>
              </div>
              <p className="text-slate-400 text-xs mt-2">
                Toggle on to auto-publish articles. Toggle off to create as drafts for review.
              </p>
            </div>
          </div>

          {/* Bills Automation Controls */}
          <div className="mb-8 p-6 bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl">
            <h3
              className="text-2xl font-semibold text-white mb-4 pb-2 border-b border-[#C60C30]/30"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Bills Automation
            </h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => triggerCron('bills-news')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'bills-news' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Newspaper className="w-4 h-4" />
                )}
                Scan for Bills News
              </button>
              <button
                onClick={() => triggerCron('bills-weekly')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'bills-weekly' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Calendar className="w-4 h-4" />
                )}
                Generate Bills Weekly Roundup
              </button>
              <button
                onClick={() => triggerCron('bills-game-recap')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'bills-game-recap' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trophy className="w-4 h-4" />
                )}
                Generate Bills Game Recaps
              </button>
            </div>

            {/* Bills Auto-publish toggles */}
            <div className="mt-6 pt-4 border-t border-slate-500">
              <p className="text-slate-300 text-sm mb-3">Bills auto-publish settings:</p>
              <div className="flex flex-wrap gap-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-bills-news')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-bills-news'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-bills-news' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-bills-news'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">News Scan</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-bills-weekly')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-bills-weekly'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-bills-weekly' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-bills-weekly'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">Weekly Roundup</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    onClick={() => toggleSetting('auto-publish-bills-game-recap')}
                    disabled={togglingSettings !== null}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      autoPublishSettings['auto-publish-bills-game-recap'] ? 'bg-green-600' : 'bg-slate-500'
                    } ${togglingSettings === 'auto-publish-bills-game-recap' ? 'opacity-50' : ''}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        autoPublishSettings['auto-publish-bills-game-recap'] ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm">Game Recaps</span>
                </label>
              </div>
              <p className="text-slate-400 text-xs mt-2">
                Toggle on to auto-publish Bills articles. Toggle off to create as drafts for review.
              </p>
            </div>
          </div>

          {/* Schedule Reference */}
          <div className="mb-8">
            <button
              onClick={() => setShowSchedule(!showSchedule)}
              className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors mb-2"
            >
              <Clock className="w-4 h-4" />
              <span>Automation Schedule Reference</span>
              {showSchedule ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
            {showSchedule && (
              <div className="p-4 bg-slate-600/30 rounded-xl border border-slate-500">
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Sabres Schedule */}
                  <div>
                    <h4 className="text-sm font-semibold text-[#FCB514] mb-3">Sabres</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">Weekly Roundup</span>
                        <span className="text-slate-300">Mondays ~5-6 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">News Scan</span>
                        <span className="text-slate-300">Tue/Thu/Sat ~5-6 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Game Recap</span>
                        <span className="text-slate-300">Daily ~11 PM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Set Recap</span>
                        <span className="text-slate-300">Sundays ~6-7 AM</span>
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
                        <span className="text-slate-300">Mon/Wed/Fri ~5-6 AM</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">Game Recap</span>
                        <span className="text-slate-300">Mondays ~12 AM & ~5 AM</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-slate-500 text-xs mt-4 text-center">
                  All times approximate Eastern. Cron jobs run on Vercel's schedule.
                </p>
              </div>
            )}
          </div>

          {/* Bulk Action Bar */}
          {selectedSlugs.size > 0 && (
            <div className="mb-6 p-4 bg-[#FCB514]/10 border-2 border-[#FCB514]/50 rounded-xl flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-white">
                <CheckSquare className="w-5 h-5 text-[#FCB514]" />
                <span className="font-semibold">
                  {selectedSlugs.size} selected
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBulkStatusChange('published')}
                  disabled={bulkOperating}
                  className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkOperating ? 'Working...' : 'Publish'}
                </button>
                <button
                  onClick={() => handleBulkStatusChange('draft')}
                  disabled={bulkOperating}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkOperating ? 'Working...' : 'Set Draft'}
                </button>
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkOperating}
                  className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {bulkOperating ? 'Deleting...' : 'Delete'}
                </button>
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
            <div className="mb-6 p-4 bg-slate-600/30 rounded-xl border border-slate-500 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium">Filters:</span>
              </div>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value as FilterTeam)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:border-[#FCB514]"
              >
                <option value="all">All Teams</option>
                <option value="sabres">Sabres</option>
                <option value="bills">Bills</option>
              </select>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:border-[#FCB514]"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as FilterType)}
                className="px-3 py-1.5 bg-slate-700 border border-slate-500 rounded-lg text-white text-sm focus:outline-none focus:border-[#FCB514]"
              >
                <option value="all">All Types</option>
                <option value="game-recap">Game Recap</option>
                <option value="set-recap">Set Recap</option>
                <option value="news-analysis">News</option>
                <option value="weekly-roundup">Weekly Roundup</option>
                <option value="custom">Custom</option>
              </select>
              {(filterTeam !== 'all' || filterStatus !== 'all' || filterType !== 'all') && (
                <button
                  onClick={() => {
                    setFilterTeam('all');
                    setFilterStatus('all');
                    setFilterType('all');
                  }}
                  className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  Clear filters
                </button>
              )}
              <span className="ml-auto text-slate-400 text-sm">
                {filteredPosts.length} of {posts.length} posts
              </span>
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-600 border-t-[#FCB514]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400">{error}</p>
            </div>
          ) : filteredPosts.length === 0 && posts.length > 0 ? (
            <div className="text-center py-16 bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p
                className="text-slate-300 text-2xl mb-2"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                No Matching Posts
              </p>
              <p className="text-slate-400 text-sm mb-6">
                Try adjusting your filters
              </p>
              <button
                onClick={() => {
                  setFilterTeam('all');
                  setFilterStatus('all');
                  setFilterType('all');
                }}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white bg-slate-600 hover:bg-slate-500 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl">
              <FileText className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <p
                className="text-slate-300 text-2xl mb-2"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                No Posts Yet
              </p>
              <p className="text-slate-400 text-sm mb-6">
                Create your first post to get started
              </p>
              <Link
                href="/admin/posts/new"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-black shadow-lg transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: '#FCB514' }}
              >
                <Plus className="w-5 h-5" />
                Create First Post
              </Link>
            </div>
          ) : (
            <div className="bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl overflow-hidden">
              {/* Mobile card layout */}
              <div className="md:hidden">
                <div className="bg-slate-700/50 border-b border-slate-500 px-4 py-3 flex items-center justify-between">
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
                    className={`border-b border-slate-600 last:border-b-0 px-4 py-3 ${
                      selectedSlugs.has(post.slug) ? 'bg-slate-500/20' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <button
                        onClick={() => toggleSelection(post.slug)}
                        className="text-slate-400 hover:text-white transition-colors mt-0.5 shrink-0"
                      >
                        {selectedSlugs.has(post.slug) ? (
                          <CheckSquare className="w-4 h-4 text-[#FCB514]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <Link
                          href={`/admin/posts/${post.slug}`}
                          className="text-white font-medium hover:text-[#FCB514] transition-colors text-sm leading-snug block"
                        >
                          {post.title}
                        </Link>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase text-white"
                            style={{ backgroundColor: post.team === 'sabres' ? '#003087' : '#C60C30' }}
                          >
                            {post.team}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                              post.status === 'published' ? 'bg-green-600 text-white' : 'bg-amber-500 text-black'
                            }`}
                          >
                            {post.status}
                          </span>
                          {post.pinned && (
                            <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] rounded font-semibold">
                              Pinned
                            </span>
                          )}
                          <span className="text-slate-500 text-xs">{post.views?.toLocaleString() ?? '0'} views</span>
                        </div>
                        <div className="flex items-center gap-1 mt-2">
                          <button
                            onClick={() => handlePin(post)}
                            disabled={pinning === post.id}
                            className={`p-1.5 rounded transition-colors disabled:opacity-50 ${
                              post.pinned ? 'text-amber-400' : 'text-slate-400 hover:text-amber-400'
                            }`}
                            title={post.pinned ? 'Unpin' : 'Pin'}
                          >
                            {pinning === post.id ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-500 border-t-amber-400"></div>
                            ) : (
                              <Pin className={`w-3.5 h-3.5 ${post.pinned ? 'fill-current' : ''}`} />
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
                              <Eye className="w-3.5 h-3.5" />
                            </a>
                          )}
                          {post.status === 'published' && (
                            <button
                              onClick={() => setSharingPost(post)}
                              className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
                              title="Share"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <Link
                            href={`/admin/posts/${post.slug}`}
                            className="p-1.5 rounded text-slate-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </Link>
                          <button
                            onClick={() => handleDelete(post)}
                            disabled={deleting === post.id}
                            className="p-1.5 rounded text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === post.id ? (
                              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-slate-500 border-t-red-400"></div>
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop table layout */}
              <table className="w-full hidden md:table">
                <thead>
                  <tr className="bg-slate-700/50 border-b border-slate-500">
                    <th className="w-12 px-4 py-4">
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
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Title
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Team
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      <button
                        onClick={() => {
                          if (sortField === 'views') {
                            setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                          } else {
                            setSortField('views');
                            setSortDirection('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-white transition-colors"
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
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide hidden lg:table-cell">
                      <button
                        onClick={() => {
                          if (sortField === 'date') {
                            setSortDirection(sortDirection === 'desc' ? 'asc' : 'desc');
                          } else {
                            setSortField('date');
                            setSortDirection('desc');
                          }
                        }}
                        className="flex items-center gap-1 hover:text-white transition-colors"
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
                    <th className="text-right px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPosts.map((post) => (
                    <tr
                      key={post.id}
                      className={`border-b border-slate-600 last:border-b-0 hover:bg-slate-500/30 transition-colors ${
                        selectedSlugs.has(post.slug) ? 'bg-slate-500/20' : ''
                      }`}
                    >
                      <td className="w-12 px-4 py-4">
                        <button
                          onClick={() => toggleSelection(post.slug)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {selectedSlugs.has(post.slug) ? (
                            <CheckSquare className="w-5 h-5 text-[#FCB514]" />
                          ) : (
                            <Square className="w-5 h-5" />
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/admin/posts/${post.slug}`}
                            className="text-white font-medium hover:text-[#FCB514] transition-colors"
                          >
                            {post.title}
                          </Link>
                          {post.pinned && (
                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-semibold shrink-0">
                              Pinned
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold uppercase text-white"
                          style={{
                            backgroundColor: post.team === 'sabres' ? '#003087' : '#C60C30',
                          }}
                        >
                          {post.team}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            post.status === 'published'
                              ? 'bg-green-600 text-white'
                              : 'bg-amber-500 text-black'
                          }`}
                        >
                          {post.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm">
                        {post.views?.toLocaleString() ?? '0'}
                      </td>
                      <td className="px-6 py-4 text-slate-400 text-sm hidden lg:table-cell">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handlePin(post)}
                            disabled={pinning === post.id}
                            className={`p-2 transition-colors disabled:opacity-50 ${
                              post.pinned
                                ? 'text-amber-400 hover:text-amber-300'
                                : 'text-slate-400 hover:text-amber-400'
                            }`}
                            title={post.pinned ? 'Unpin' : 'Pin to featured'}
                          >
                            {pinning === post.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-amber-400"></div>
                            ) : (
                              <Pin className={`w-4 h-4 ${post.pinned ? 'fill-current' : ''}`} />
                            )}
                          </button>
                          {post.status === 'published' && (
                            <a
                              href={`/blog/${post.team}/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-slate-400 hover:text-white transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          {post.status === 'published' && (
                            <button
                              onClick={() => setSharingPost(post)}
                              className="p-2 text-slate-400 hover:text-white transition-colors"
                              title="Share to X"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          )}
                          <Link
                            href={`/admin/posts/${post.slug}`}
                            className="p-2 text-slate-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(post)}
                            disabled={deleting === post.id}
                            className="p-2 text-slate-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === post.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-red-400"></div>
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </main>
      </div>

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
