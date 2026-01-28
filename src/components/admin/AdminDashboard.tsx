import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Edit, Trash2, Eye, LogOut, FileText, RefreshCw, Newspaper, Calendar, Trophy } from 'lucide-react';
import { fetchPosts, deletePost } from '../../services/blogApi';
import { logout } from '../../utils/auth';
import type { BlogPost } from '../../types';

export default function AdminDashboard() {
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [triggerResult, setTriggerResult] = useState<{ type: string; success: boolean; message: string } | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadPosts();
  }, []);

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

  async function handleLogout() {
    await logout();
    navigate('/admin/login');
  }

  async function triggerCron(type: 'weekly' | 'news' | 'game-recap') {
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

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <h1
              className="text-2xl font-bold text-white"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Admin Dashboard
            </h1>
            <div className="flex items-center gap-4">
              <Link
                to="/blog"
                className="text-gray-400 hover:text-white text-sm transition-colors"
              >
                View Blog
              </Link>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {/* Actions */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2
                className="text-3xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Posts
              </h2>
              <p className="text-gray-400 text-sm mt-1">
                {posts.length} post{posts.length !== 1 ? 's' : ''} total
              </p>
            </div>
            <Link
              to="/admin/posts/new"
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-black transition-all duration-300 hover:scale-105"
              style={{ backgroundColor: '#FCB514' }}
            >
              <Plus className="w-5 h-5" />
              New Post
            </Link>
          </div>

          {/* Automation Controls */}
          <div className="mb-8 p-6 bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl border-2 border-gray-700">
            <h3
              className="text-xl font-semibold text-white mb-4"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Automation
            </h3>
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => triggerCron('weekly')}
                disabled={triggering !== null}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-green-600 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {triggering === 'game-recap' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Trophy className="w-4 h-4" />
                )}
                Generate Game Recaps
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
                <strong>{triggerResult.type === 'weekly' ? 'Weekly Roundup' : triggerResult.type === 'news' ? 'News Scan' : 'Game Recap'}:</strong>{' '}
                {triggerResult.message}
              </div>
            )}
            <p className="text-gray-500 text-sm mt-4">
              Articles are created as drafts by default. Set AUTO_PUBLISH_WEEKLY, AUTO_PUBLISH_NEWS, or AUTO_PUBLISH_GAME_RECAP to "true" in environment variables to auto-publish.
            </p>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-16">
              <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]"></div>
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-red-400">{error}</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl border-2 border-[#FCB514]">
              <FileText className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p
                className="text-gray-400 text-2xl mb-2"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                No Posts Yet
              </p>
              <p className="text-gray-500 text-sm mb-6">
                Create your first post to get started
              </p>
              <Link
                to="/admin/posts/new"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all duration-300 hover:scale-105"
                style={{ backgroundColor: '#FCB514' }}
              >
                <Plus className="w-5 h-5" />
                Create First Post
              </Link>
            </div>
          ) : (
            <div className="bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl border-2 border-[#FCB514] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-600">
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">
                      Title
                    </th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold text-sm uppercase tracking-wide hidden md:table-cell">
                      Team
                    </th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold text-sm uppercase tracking-wide hidden md:table-cell">
                      Status
                    </th>
                    <th className="text-left px-6 py-4 text-gray-400 font-semibold text-sm uppercase tracking-wide hidden lg:table-cell">
                      Date
                    </th>
                    <th className="text-right px-6 py-4 text-gray-400 font-semibold text-sm uppercase tracking-wide">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => (
                    <tr
                      key={post.id}
                      className="border-b border-gray-700 last:border-b-0 hover:bg-black/20 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-white font-medium">{post.title}</p>
                          <p className="text-gray-500 text-sm md:hidden">
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
                      <td className="px-6 py-4 text-gray-400 text-sm hidden lg:table-cell">
                        {formatDate(post.publishedAt || post.createdAt)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          {post.status === 'published' && (
                            <a
                              href={`/blog/${post.team}/${post.slug}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-2 text-gray-400 hover:text-white transition-colors"
                              title="View"
                            >
                              <Eye className="w-4 h-4" />
                            </a>
                          )}
                          <Link
                            to={`/admin/posts/${post.slug}`}
                            className="p-2 text-gray-400 hover:text-white transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(post)}
                            disabled={deleting === post.id}
                            className="p-2 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                            title="Delete"
                          >
                            {deleting === post.id ? (
                              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-red-400"></div>
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
