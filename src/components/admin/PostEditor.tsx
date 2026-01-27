import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Save, Eye, EyeOff, Send, Sparkles } from 'lucide-react';
import { fetchPost, createPost, updatePost, generateArticle } from '../../services/blogApi';
import PostContent from '../blog/PostContent';
import type { BlogPost } from '../../types';

type PostFormData = {
  title: string;
  content: string;
  team: 'sabres' | 'bills';
  type: 'game-recap' | 'set-recap' | 'custom';
  status: 'draft' | 'published';
  opponent: string;
  gameDate: string;
  metaDescription: string;
};

const teamConfig = {
  sabres: { accent: '#FCB514' },
  bills: { accent: '#C60C30' },
};

export default function PostEditor() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const isNew = slug === 'new';

  const [formData, setFormData] = useState<PostFormData>({
    title: '',
    content: '',
    team: 'sabres',
    type: 'custom',
    status: 'draft',
    opponent: '',
    gameDate: '',
    metaDescription: '',
  });

  const [existingPost, setExistingPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // AI generation state
  const [articleIdea, setArticleIdea] = useState('');
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  useEffect(() => {
    if (!isNew && slug) {
      loadPost(slug);
    }
  }, [isNew, slug]);

  async function loadPost(postSlug: string) {
    try {
      setLoading(true);
      const data = await fetchPost(postSlug);
      setExistingPost(data.post);
      setFormData({
        title: data.post.title,
        content: data.post.content,
        team: data.post.team,
        type: data.post.type,
        status: data.post.status,
        opponent: data.post.opponent || '',
        gameDate: data.post.gameDate || '',
        metaDescription: data.post.metaDescription || '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load post');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      if (isNew) {
        const result = await createPost({
          title: formData.title,
          content: formData.content,
          team: formData.team,
          type: formData.type,
          status: formData.status,
          opponent: formData.opponent || undefined,
          gameDate: formData.gameDate || undefined,
          metaDescription: formData.metaDescription || undefined,
        });
        navigate(`/admin/posts/${result.post.slug}`);
      } else if (existingPost) {
        await updatePost(existingPost.slug, {
          title: formData.title,
          content: formData.content,
          status: formData.status,
          opponent: formData.opponent || undefined,
          gameDate: formData.gameDate || undefined,
          metaDescription: formData.metaDescription || undefined,
        });
      }
      navigate('/admin/posts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    setFormData({ ...formData, status: 'published' });
    // Submit will be triggered by form
  }

  const updateField = <K extends keyof PostFormData>(
    field: K,
    value: PostFormData[K]
  ) => {
    setFormData({ ...formData, [field]: value });
  };

  async function handleGenerateArticle() {
    if (!articleIdea.trim()) return;

    setGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateArticle({
        idea: articleIdea,
        team: formData.team,
        title: formData.title || undefined,
        researchEnabled,
      });

      setFormData((prev) => ({
        ...prev,
        title: prev.title || result.title,
        content: result.content,
        metaDescription: result.metaDescription || prev.metaDescription,
      }));

      setArticleIdea(''); // Clear after success
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate article');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-700 border-t-[#FCB514]"></div>
      </div>
    );
  }

  const accent = teamConfig[formData.team].accent;

  return (
    <>
      <Helmet>
        <title>{isNew ? 'New Post' : 'Edit Post'} | Lindy's Five Admin</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        {/* Header */}
        <header className="border-b border-gray-700">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/admin/posts"
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back
              </Link>
              <h1
                className="text-2xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                {isNew ? 'New Post' : 'Edit Post'}
              </h1>
            </div>
            <button
              onClick={() => setShowPreview(!showPreview)}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              {showPreview ? (
                <>
                  <EyeOff className="w-4 h-4" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="w-4 h-4" />
                  Preview
                </>
              )}
            </button>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          {error && (
            <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
            {/* Editor */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FCB514] transition-colors"
                  placeholder="Post title"
                  required
                />
              </div>

              {/* Team & Type (only for new posts) */}
              {isNew && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Team
                    </label>
                    <select
                      value={formData.team}
                      onChange={(e) =>
                        updateField('team', e.target.value as 'sabres' | 'bills')
                      }
                      className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                    >
                      <option value="sabres">Sabres</option>
                      <option value="bills">Bills</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Type
                    </label>
                    <select
                      value={formData.type}
                      onChange={(e) =>
                        updateField(
                          'type',
                          e.target.value as 'game-recap' | 'set-recap' | 'custom'
                        )
                      }
                      className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                    >
                      <option value="custom">Custom Article</option>
                      <option value="game-recap">Game Recap</option>
                      <option value="set-recap">Set Recap</option>
                    </select>
                  </div>
                </div>
              )}

              {/* AI Article Generator - Only for new custom articles */}
              {isNew && formData.type === 'custom' && (
                <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 border border-purple-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-400" />
                      AI Article Generator
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm text-gray-400">Research</span>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          researchEnabled ? 'bg-purple-500' : 'bg-gray-600'
                        }`}
                        onClick={() => setResearchEnabled(!researchEnabled)}
                      >
                        <div
                          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                            researchEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Article Idea / Instructions
                    </label>
                    <textarea
                      value={articleIdea}
                      onChange={(e) => setArticleIdea(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-400 transition-colors text-sm"
                      placeholder="Describe what you want the article to cover. Be specific about topics, players, stats, comparisons, or themes you want included..."
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      {researchEnabled
                        ? 'Research mode: AI will search the web for current stats and information.'
                        : "Tip: Enable 'Research' for AI to look up current stats and news."}
                    </p>
                  </div>

                  {generateError && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                      {generateError}
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-500 to-blue-500 animate-pulse"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <p className="text-gray-400 text-sm mt-2 text-center">
                        Generating your article... This may take 15-30 seconds.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateArticle}
                    disabled={generating || !articleIdea.trim()}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Draft
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Opponent & Date (for game recaps) */}
              {(formData.type === 'game-recap' || formData.type === 'set-recap') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Opponent
                    </label>
                    <input
                      type="text"
                      value={formData.opponent}
                      onChange={(e) => updateField('opponent', e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FCB514] transition-colors"
                      placeholder="e.g., Rangers"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">
                      Game Date
                    </label>
                    <input
                      type="date"
                      value={formData.gameDate}
                      onChange={(e) => updateField('gameDate', e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Content (Markdown)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={20}
                  className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FCB514] transition-colors font-mono text-sm"
                  placeholder="Write your post content in Markdown..."
                  required
                />
              </div>

              {/* Meta Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Meta Description (SEO)
                </label>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => updateField('metaDescription', e.target.value)}
                  rows={2}
                  maxLength={160}
                  className="w-full px-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FCB514] transition-colors text-sm"
                  placeholder="Brief description for search results (max 160 chars)"
                />
                <p className="text-gray-500 text-xs mt-1">
                  {formData.metaDescription.length}/160 characters
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
                >
                  <Save className="w-5 h-5" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  onClick={handlePublish}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
                  style={{ backgroundColor: accent }}
                >
                  <Send className="w-5 h-5" />
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>

            {/* Preview */}
            {showPreview && (
              <div className="bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl border-2 border-[#FCB514] p-6 overflow-auto max-h-[calc(100vh-200px)]">
                <h2
                  className="text-2xl font-bold text-white mb-4"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Preview
                </h2>
                {formData.title && (
                  <h3
                    className="text-3xl font-bold text-white mb-6"
                    style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                  >
                    {formData.title}
                  </h3>
                )}
                {formData.content ? (
                  <PostContent content={formData.content} accent={accent} />
                ) : (
                  <p className="text-gray-500 italic">
                    Start typing to see preview...
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
