import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Edit, Trash2, Eye, LogOut, FileText, RefreshCw, Newspaper, Calendar, Trophy, Layers, Pin } from 'lucide-react';
import { fetchPosts, deletePost, updatePost } from '../../services/blogApi';
import { logout } from '../../utils/auth';
import type { BlogPost } from '../../types';

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
  const navigate = useNavigate();

  useEffect(() => {
    loadPosts();
    loadSettings();
  }, []);

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

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  async function triggerCron(type: 'weekly' | 'news' | 'game-recap' | 'set-recap' | 'bills-news' | 'bills-weekly' | 'bills-game-recap') {
    setTriggering(type);
    setTriggerResult(null);
    try {
      const response = await fetch('/api/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type }),
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
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <>
      <Helmet>
        <title>Admin Dashboard | Lindy's Five</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800">
        {/* Header - Blog Style */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: '#003087',
            borderBottomColor: '#0A1128',
          }}
        >
          <div className="max-w-7xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <h1
                className="text-4xl md:text-5xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Admin Dashboard
              </h1>
              <div className="flex items-center gap-4">
                <Link
                  to="/blog"
                  className="text-white/70 hover:text-white text-sm transition-colors"
                >
                  View Blog
                </Link>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

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
              to="/admin/posts/new"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'game-recap' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trophy className="w-4 h-4" />
                )}
                Generate Game Recaps
              </button>
              <button
                onClick={() => triggerCron('set-recap')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'set-recap' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Layers className="w-4 h-4" />
                )}
                Generate Set Recap
              </button>
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-slate-500 hover:bg-slate-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-600 border-t-[#FCB514]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400">{error}</p>
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
                to="/admin/posts/new"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-black shadow-lg transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: '#FCB514' }}
              >
                <Plus className="w-5 h-5" />
                Create First Post
              </Link>
            </div>
          ) : (
            <div className="bg-slate-600/50 rounded-2xl border-2 border-slate-500 shadow-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-700/50 border-b border-slate-500">
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Title
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide hidden md:table-cell">
                      Team
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide hidden md:table-cell">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide hidden lg:table-cell">
                      Date
                    </th>
                    <th className="text-right px-6 py-4 text-slate-300 font-semibold text-sm uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-slate-600 last:border-b-0 hover:bg-slate-500/30 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-white font-medium">{post.title}</p>
                            {post.pinned && (
                              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded font-semibold">
                                Pinned
                              </span>
                            )}
                          </div>
                          <p className="text-slate-400 text-sm md:hidden">
                            {post.team} • {post.status}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span
                          className="px-2 py-1 rounded text-xs font-semibold uppercase"
                          style={{
                            backgroundColor:
                              post.team === 'sabres'
                                ? 'rgba(252, 181, 20, 0.2)'
                                : 'rgba(198, 12, 48, 0.2)',
                            color: post.team === 'sabres' ? '#FCB514' : '#C60C30',
                          }}
                        >
                          {post.team}
                        </span>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell">
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            post.status === 'published'
                              ? 'bg-green-900/30 text-green-400'
                              : 'bg-yellow-900/30 text-yellow-400'
                          }`}
                        >
                          {post.status}
                        </span>
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
                          <Link
                            to={`/admin/posts/${post.slug}`}
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
    </>
  );
}
