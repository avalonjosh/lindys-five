import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { ArrowLeft, Save, Eye, EyeOff, Send, Sparkles, ImagePlus, X, Upload, Calendar, Images, ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';
import { fetchPost, createPost, updatePost, generateArticle, uploadImage, fetchImages, factCheckArticle, type FactCheckResponse, type FactCheckFinding } from '../../services/blogApi';
import { fetchSabresSchedule } from '../../services/nhlApi';
import { calculateChunks } from '../../utils/chunkCalculator';
import PostContent from '../blog/PostContent';
import type { BlogPost, GameChunk } from '../../types';

// Game option for the selector dropdown
interface GameOption {
  gameId: number;
  date: string;
  opponent: string;
  isHome: boolean;
  sabresScore: number;
  opponentScore: number;
  outcome: 'W' | 'OTL' | 'L';
}

type PostFormData = {
  title: string;
  content: string;
  team: 'sabres' | 'bills';
  type: 'game-recap' | 'set-recap' | 'custom' | 'weekly-roundup' | 'news-analysis';
  status: 'draft' | 'published';
  opponent: string;
  gameDate: string;
  gameId?: number;
  setNumber?: number;
  metaDescription: string;
  publishedAt: string;
  pinned: boolean;
};

const teamConfig = {
  sabres: { accent: '#FCB514' },
  bills: { accent: '#C60C30' },
};

// Default trusted sources for research (includes specific live data pages)
const DEFAULT_RESEARCH_DOMAINS = [
  'nhl.com',
  'espn.com',
  'hockey-reference.com',
  'eliteprospects.com',
  'theathletic.com',
  'sabres.com',
];

// Image upload validation
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif'];

// Convert ISO string to datetime-local format (respects local timezone)
function isoToDatetimeLocal(isoString: string): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

// Convert datetime-local string to ISO (for saving)
function datetimeLocalToIso(localString: string): string {
  if (!localString) return '';
  const date = new Date(localString);
  if (isNaN(date.getTime())) return '';
  return date.toISOString();
}

// Extract images from markdown content
interface ContentImage {
  url: string;
  alt: string;
  fullMatch: string;
}

function extractImagesFromContent(content: string): ContentImage[] {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images: ContentImage[] = [];
  let match;
  while ((match = imageRegex.exec(content)) !== null) {
    images.push({
      alt: match[1],
      url: match[2],
      fullMatch: match[0],
    });
  }
  return images;
}

// Remove an image from markdown content
function removeImageFromContent(content: string, url: string): string {
  // Escape special regex characters in the URL
  const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match the full markdown image syntax with this URL, plus surrounding whitespace
  const imageRegex = new RegExp(`\\n*!\\[[^\\]]*\\]\\(${escapedUrl}\\)\\n*`, 'g');
  return content.replace(imageRegex, '\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

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
    publishedAt: '',
    pinned: false,
  });

  const [existingPost, setExistingPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  // AI generation state
  const [articleIdea, setArticleIdea] = useState('');
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [customizeResearch, setCustomizeResearch] = useState(false);
  const [customDomains, setCustomDomains] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Game recap state
  const [recentGames, setRecentGames] = useState<GameOption[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  // Set recap state
  const [completedSets, setCompletedSets] = useState<GameChunk[]>([]);
  const [loadingSets, setLoadingSets] = useState(false);

  // Image upload state
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [featuredImage, setFeaturedImage] = useState<string | null>(null);

  // Image gallery state
  const [showGallery, setShowGallery] = useState(false);
  const [galleryImages, setGalleryImages] = useState<{ url: string; filename: string; uploadedAt: string }[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [galleryError, setGalleryError] = useState<string | null>(null);

  // Fact check state
  const [factChecking, setFactChecking] = useState(false);
  const [factCheckResults, setFactCheckResults] = useState<FactCheckResponse | null>(null);
  const [factCheckError, setFactCheckError] = useState<string | null>(null);
  const [showFactCheckResults, setShowFactCheckResults] = useState(false);

  // Auto-populated reference date for research accuracy
  const getTodayFormatted = () => {
    return new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };
  const referenceDate = getTodayFormatted();

  useEffect(() => {
    if (!isNew && slug) {
      loadPost(slug);
    }
  }, [isNew, slug]);

  // Fetch recent completed games when type is game-recap
  useEffect(() => {
    async function loadRecentGames() {
      if (formData.type !== 'game-recap' || formData.team !== 'sabres') {
        setRecentGames([]);
        return;
      }

      setLoadingGames(true);
      try {
        const schedule = await fetchSabresSchedule();
        // Filter to completed games and get last 10
        const completedGames = schedule
          .filter((g) => g.outcome !== 'PENDING' && g.gameId)
          .slice(-10)
          .reverse() // Most recent first
          .map((g) => ({
            gameId: g.gameId!,
            date: g.date,
            opponent: g.opponent,
            isHome: g.isHome,
            sabresScore: g.sabresScore,
            opponentScore: g.opponentScore,
            outcome: g.outcome as 'W' | 'OTL' | 'L',
          }));
        setRecentGames(completedGames);
      } catch (err) {
        console.error('Failed to load recent games:', err);
        setRecentGames([]);
      } finally {
        setLoadingGames(false);
      }
    }

    loadRecentGames();
  }, [formData.type, formData.team]);

  // Fetch completed sets when type is set-recap
  useEffect(() => {
    async function loadCompletedSets() {
      if (formData.type !== 'set-recap' || formData.team !== 'sabres') {
        setCompletedSets([]);
        return;
      }

      setLoadingSets(true);
      try {
        const schedule = await fetchSabresSchedule();
        const chunks = calculateChunks(schedule);
        // Filter to only completed sets
        const completed = chunks.filter((chunk) => chunk.isComplete);
        setCompletedSets(completed);
      } catch (err) {
        console.error('Failed to load completed sets:', err);
        setCompletedSets([]);
      } finally {
        setLoadingSets(false);
      }
    }

    loadCompletedSets();
  }, [formData.type, formData.team]);

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
        // Convert ISO to datetime-local format for the input
        publishedAt: isoToDatetimeLocal(data.post.publishedAt || ''),
        pinned: data.post.pinned || false,
      });
      // Load existing featured image
      if (data.post.ogImage) {
        setFeaturedImage(data.post.ogImage);
      }
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
      // Convert datetime-local to ISO for API
      const publishedAtISO = datetimeLocalToIso(formData.publishedAt) || undefined;

      if (isNew) {
        const result = await createPost({
          title: formData.title,
          content: formData.content,
          team: formData.team,
          type: formData.type,
          status: formData.status,
          opponent: formData.opponent || undefined,
          gameDate: formData.gameDate || undefined,
          gameId: formData.gameId || undefined,
          metaDescription: formData.metaDescription || undefined,
          ogImage: featuredImage || undefined,
          publishedAt: publishedAtISO,
          pinned: formData.pinned,
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
          ogImage: featuredImage || undefined,
          publishedAt: publishedAtISO,
          pinned: formData.pinned,
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

    // Determine which domains to use for research
    let allowedDomains: string[] | undefined;
    if (researchEnabled) {
      if (customizeResearch && customDomains.trim()) {
        // Parse custom domains (comma or newline separated)
        allowedDomains = customDomains
          .split(/[,\n]/)
          .map((d) => d.trim())
          .filter((d) => d.length > 0);
      } else {
        // Use default domains
        allowedDomains = DEFAULT_RESEARCH_DOMAINS;
      }
    }

    try {
      const result = await generateArticle({
        idea: articleIdea,
        team: formData.team,
        title: formData.title || undefined,
        researchEnabled,
        allowedDomains,
        referenceDate: researchEnabled ? referenceDate : undefined,
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

  function handleGameSelect(gameId: string) {
    if (!gameId) {
      setFormData((prev) => ({
        ...prev,
        gameId: undefined,
        opponent: '',
        gameDate: '',
      }));
      return;
    }

    const game = recentGames.find((g) => g.gameId === parseInt(gameId, 10));
    if (game) {
      // Convert date from MM/DD/YYYY to YYYY-MM-DD for date input
      const [month, day, year] = game.date.split('/');
      const isoDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

      setFormData((prev) => ({
        ...prev,
        gameId: game.gameId,
        opponent: game.opponent,
        gameDate: isoDate,
      }));
    }
  }

  async function handleGenerateRecap() {
    if (!formData.gameId) return;

    const game = recentGames.find((g) => g.gameId === formData.gameId);
    if (!game) return;

    setGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateArticle({
        idea: `Write a game recap for the Sabres ${game.outcome === 'W' ? 'victory' : 'loss'} against the ${game.opponent} on ${game.date}. Final score: Sabres ${game.sabresScore}, ${game.opponent} ${game.opponentScore}.`,
        team: formData.team,
        title: formData.title || undefined,
        gameId: formData.gameId,
        postType: 'game-recap',
        // No researchEnabled - web search disabled for game recaps
      });

      setFormData((prev) => ({
        ...prev,
        title: prev.title || result.title,
        content: result.content,
        metaDescription: result.metaDescription || prev.metaDescription,
      }));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate recap');
    } finally {
      setGenerating(false);
    }
  }

  function handleSetSelect(setNum: string) {
    if (!setNum) {
      setFormData((prev) => ({
        ...prev,
        setNumber: undefined,
        opponent: '',
        gameDate: '',
      }));
      return;
    }

    const selectedSet = completedSets.find((s) => s.chunkNumber === parseInt(setNum, 10));
    if (selectedSet && selectedSet.games.length > 0) {
      // Build opponents string
      const opponents = selectedSet.games.map((g) => g.opponent).join(', ');

      // Get date range
      const firstGame = selectedSet.games[0];
      const lastGame = selectedSet.games[selectedSet.games.length - 1];
      const dateRange = `${firstGame.date} - ${lastGame.date}`;

      setFormData((prev) => ({
        ...prev,
        setNumber: selectedSet.chunkNumber,
        opponent: opponents,
        gameDate: dateRange,
      }));
    }
  }

  async function handleGenerateSetRecap() {
    if (!formData.setNumber) return;

    const selectedSet = completedSets.find((s) => s.chunkNumber === formData.setNumber);
    if (!selectedSet) return;

    setGenerating(true);
    setGenerateError(null);

    try {
      const result = await generateArticle({
        idea: `Write a set recap for the Sabres' Set #${formData.setNumber}. They went ${selectedSet.wins}-${selectedSet.losses}-${selectedSet.otLosses} earning ${selectedSet.points} out of a possible ${selectedSet.maxPoints} points.`,
        team: formData.team,
        title: formData.title || undefined,
        setNumber: formData.setNumber,
        postType: 'set-recap',
        // No researchEnabled - use verified data only
      });

      setFormData((prev) => ({
        ...prev,
        title: prev.title || result.title,
        content: result.content,
        metaDescription: result.metaDescription || prev.metaDescription,
      }));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate set recap');
    } finally {
      setGenerating(false);
    }
  }

  // Image upload handlers
  function validateFile(file: File): string | null {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      return `Invalid file type. Allowed: ${ALLOWED_EXTENSIONS.join(', ')}`;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      return `File too large. Maximum size: ${MAX_IMAGE_SIZE / 1024 / 1024}MB`;
    }
    return null;
  }

  async function handleImageUpload(file: File) {
    const validationError = validateFile(file);
    if (validationError) {
      setUploadError(validationError);
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const result = await uploadImage(file);

      // Track uploaded images for gallery
      setUploadedImages((prev) => [...prev, result.url]);

      // First image becomes the featured image (ogImage), subsequent images embed in content
      if (!featuredImage) {
        setFeaturedImage(result.url);
      } else {
        // Insert markdown image reference at end of content
        const markdownImage = `![${file.name}](${result.url})`;
        setFormData((prev) => ({
          ...prev,
          content: prev.content + (prev.content ? '\n\n' : '') + markdownImage,
        }));
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
    // Reset input so same file can be selected again
    e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function insertImageAtCursor(url: string, altText: string = 'Image') {
    const markdownImage = `![${altText}](${url})`;
    setFormData((prev) => ({
      ...prev,
      content: prev.content + (prev.content ? '\n\n' : '') + markdownImage,
    }));
  }

  async function loadGalleryImages() {
    setLoadingGallery(true);
    setGalleryError(null);
    try {
      const result = await fetchImages();
      setGalleryImages(result.images);
    } catch (err) {
      console.error('Failed to load gallery images:', err);
      setGalleryError(err instanceof Error ? err.message : 'Failed to load images');
    } finally {
      setLoadingGallery(false);
    }
  }

  function openGallery() {
    setShowGallery(true);
    loadGalleryImages();
  }

  function selectFromGallery(url: string, asFeatured: boolean) {
    if (asFeatured) {
      setFeaturedImage(url);
    } else {
      insertImageAtCursor(url, 'Image');
    }
    setShowGallery(false);
  }

  async function handleFactCheck() {
    if (!formData.content.trim()) {
      setFactCheckError('No content to fact-check');
      return;
    }

    setFactChecking(true);
    setFactCheckError(null);
    setFactCheckResults(null);

    try {
      const results = await factCheckArticle({
        content: formData.content,
        team: formData.team,
        type: formData.type,
        gameId: formData.gameId,
      });

      setFactCheckResults(results);
      setShowFactCheckResults(true);
    } catch (err) {
      setFactCheckError(err instanceof Error ? err.message : 'Failed to fact-check article');
    } finally {
      setFactChecking(false);
    }
  }

  function getCategoryIcon(category: FactCheckFinding['category']) {
    switch (category) {
      case 'verified':
        return <CheckCircle2 className="w-4 h-4 text-green-400" />;
      case 'issue':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'unverifiable':
        return <HelpCircle className="w-4 h-4 text-slate-400" />;
    }
  }

  function getCategoryColor(category: FactCheckFinding['category']) {
    switch (category) {
      case 'verified':
        return 'border-green-500/30 bg-green-900/20';
      case 'issue':
        return 'border-red-500/30 bg-red-900/20';
      case 'warning':
        return 'border-amber-500/30 bg-amber-900/20';
      case 'unverifiable':
        return 'border-slate-500/30 bg-slate-700/20';
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-600 border-t-[#FCB514]"></div>
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

      <div className="min-h-screen bg-gradient-to-br from-slate-700 to-slate-800">
        {/* Header */}
        <header
          className="shadow-xl border-b-4"
          style={{
            background: '#003087',
            borderBottomColor: '#0A1128',
          }}
        >
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/admin/posts"
                className="flex items-center gap-2 text-white/70 hover:text-white transition-colors"
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
              className="flex items-center gap-2 text-white/70 hover:text-white text-sm transition-colors"
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
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Title
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#FCB514] transition-colors"
                  placeholder="Post title"
                  required
                />
              </div>

              {/* Team & Type (only for new posts) */}
              {isNew && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Team
                    </label>
                    <select
                      value={formData.team}
                      onChange={(e) =>
                        updateField('team', e.target.value as 'sabres' | 'bills')
                      }
                      className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                    >
                      <option value="sabres">Sabres</option>
                      <option value="bills">Bills</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
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
                      className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
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
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-indigo-400" />
                      AI Article Generator
                    </h3>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <span className="text-sm text-slate-400">Research</span>
                      <div
                        className={`relative w-11 h-6 rounded-full transition-colors ${
                          researchEnabled ? 'bg-indigo-500' : 'bg-slate-500'
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

                  {/* Reference Date - Show when research is enabled */}
                  {researchEnabled && (
                    <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg flex items-center gap-3">
                      <span className="text-blue-400 text-sm font-semibold">Reference Date:</span>
                      <span className="text-white text-sm">{referenceDate}</span>
                      <span className="text-slate-400 text-xs ml-auto">
                        AI will search for data from this date
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Article Idea / Instructions
                    </label>
                    <textarea
                      value={articleIdea}
                      onChange={(e) => setArticleIdea(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors text-sm"
                      placeholder="Describe what you want the article to cover. Be specific about topics, players, stats, comparisons, or themes you want included..."
                    />
                    <p className="text-slate-400 text-xs mt-1">
                      {researchEnabled
                        ? 'Research mode: AI will search the web for current stats and information.'
                        : "Tip: Enable 'Research' for AI to look up current stats and news."}
                    </p>
                  </div>

                  {/* Research Sources - Only show when research is enabled */}
                  {researchEnabled && (
                    <div className="mb-4 p-4 bg-black/20 rounded-lg border border-indigo-500/20">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-300">
                          Research Sources
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomizeResearch(!customizeResearch)}
                          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                        >
                          {customizeResearch ? 'Use Defaults' : 'Customize'}
                        </button>
                      </div>

                      {customizeResearch ? (
                        <div>
                          <textarea
                            value={customDomains}
                            onChange={(e) => setCustomDomains(e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-indigo-400 transition-colors text-xs font-mono"
                            placeholder="Enter domains (comma or newline separated)&#10;e.g., nhl.com, espn.com"
                          />
                          <p className="text-slate-400 text-xs mt-1">
                            AI will only search these domains
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {DEFAULT_RESEARCH_DOMAINS.map((domain) => (
                            <span
                              key={domain}
                              className="px-2 py-1 bg-indigo-500/20 text-indigo-300 text-xs rounded-full"
                            >
                              {domain}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {generateError && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                      {generateError}
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 animate-pulse"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <p className="text-slate-400 text-sm mt-2 text-center">
                        Generating your article... This may take 15-30 seconds.
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateArticle}
                    disabled={generating || !articleIdea.trim()}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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

              {/* Game Recap: Game Selector and AI Generator */}
              {isNew && formData.type === 'game-recap' && formData.team === 'sabres' && (
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    AI Game Recap Generator
                  </h3>

                  {/* Game Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Select Game
                    </label>
                    {loadingGames ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-indigo-400" />
                        Loading recent games...
                      </div>
                    ) : recentGames.length > 0 ? (
                      <select
                        value={formData.gameId || ''}
                        onChange={(e) => handleGameSelect(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-indigo-400 transition-colors"
                      >
                        <option value="">Select a game...</option>
                        {recentGames.map((g) => (
                          <option key={g.gameId} value={g.gameId}>
                            {g.date}: {g.outcome} {g.sabresScore}-{g.opponentScore} {g.isHome ? 'vs' : '@'} {g.opponent}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <p className="text-slate-400 text-sm">No recent games found</p>
                    )}
                  </div>

                  {/* Selected Game Info */}
                  {formData.gameId && (
                    <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-400">Opponent:</span>
                          <span className="text-white ml-2">{formData.opponent}</span>
                        </div>
                        <div>
                          <span className="text-slate-400">Date:</span>
                          <span className="text-white ml-2">{formData.gameDate}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {generateError && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                      {generateError}
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 animate-pulse"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <p className="text-slate-400 text-sm mt-2 text-center">
                        Fetching box score and generating recap...
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateRecap}
                    disabled={generating || !formData.gameId}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                        Generating Recap...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Recap
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Set Recap: Set Selector and AI Generator */}
              {isNew && formData.type === 'set-recap' && formData.team === 'sabres' && (
                <div className="bg-indigo-900/20 border border-indigo-500/30 rounded-xl p-6">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-indigo-400" />
                    AI Set Recap Generator
                  </h3>

                  {/* Set Selector */}
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Select Set
                    </label>
                    {loadingSets ? (
                      <div className="flex items-center gap-2 text-slate-400">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-500 border-t-indigo-400" />
                        Loading completed sets...
                      </div>
                    ) : completedSets.length > 0 ? (
                      <select
                        value={formData.setNumber || ''}
                        onChange={(e) => handleSetSelect(e.target.value)}
                        className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-indigo-400 transition-colors"
                      >
                        <option value="">Select a set...</option>
                        {completedSets.map((set) => {
                          const firstDate = set.games[0]?.date || '';
                          const lastDate = set.games[set.games.length - 1]?.date || '';
                          return (
                            <option key={set.chunkNumber} value={set.chunkNumber}>
                              Set {set.chunkNumber}: {firstDate} - {lastDate} | {set.wins}-{set.losses}-{set.otLosses} ({set.points} pts)
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <p className="text-slate-400 text-sm">No completed sets found</p>
                    )}
                  </div>

                  {/* Selected Set Info */}
                  {formData.setNumber && (
                    <div className="mb-4 p-3 bg-blue-900/30 border border-blue-500/30 rounded-lg">
                      {(() => {
                        const selectedSet = completedSets.find((s) => s.chunkNumber === formData.setNumber);
                        if (!selectedSet) return null;
                        const pointsPct = ((selectedSet.points / selectedSet.maxPoints) * 100).toFixed(0);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-slate-400">Set:</span>
                              <span className="text-white ml-2">#{formData.setNumber}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Record:</span>
                              <span className="text-white ml-2">
                                {selectedSet.wins}-{selectedSet.losses}-{selectedSet.otLosses}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Points:</span>
                              <span className="text-white ml-2">
                                {selectedSet.points}/{selectedSet.maxPoints} ({pointsPct}%)
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400">Opponents:</span>
                              <span className="text-white ml-2">{formData.opponent}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {generateError && (
                    <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-4 text-sm">
                      {generateError}
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-500 animate-pulse"
                          style={{ width: '100%' }}
                        />
                      </div>
                      <p className="text-slate-400 text-sm mt-2 text-center">
                        Fetching game data and generating set recap...
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleGenerateSetRecap}
                    disabled={generating || !formData.setNumber}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generating ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                        Generating Set Recap...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Generate Set Recap
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Manual Opponent & Date (for Bills game recaps only) */}
              {(formData.type === 'game-recap' && formData.team === 'bills') && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Opponent
                    </label>
                    <input
                      type="text"
                      value={formData.opponent}
                      onChange={(e) => updateField('opponent', e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#FCB514] transition-colors"
                      placeholder="e.g., Rangers"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-300 mb-2">
                      Game Date
                    </label>
                    <input
                      type="date"
                      value={formData.gameDate}
                      onChange={(e) => updateField('gameDate', e.target.value)}
                      className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                    />
                  </div>
                </div>
              )}

              {/* Content */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Content (Markdown)
                </label>
                <textarea
                  value={formData.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={20}
                  className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#FCB514] transition-colors font-mono text-sm"
                  placeholder="Write your post content in Markdown..."
                  required
                />
              </div>

              {/* Content Images Gallery */}
              {(() => {
                const contentImages = extractImagesFromContent(formData.content);
                if (contentImages.length === 0) return null;
                return (
                  <div className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                    <label className="block text-sm font-semibold text-slate-300 mb-3">
                      Images in Content ({contentImages.length})
                    </label>
                    <div className="flex flex-wrap gap-3">
                      {contentImages.map((img, index) => (
                        <div key={img.url} className="relative group">
                          <img
                            src={img.url}
                            alt={img.alt || `Image ${index + 1}`}
                            className="w-20 h-20 object-cover rounded-lg border border-slate-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newContent = removeImageFromContent(formData.content, img.url);
                              setFormData((prev) => ({ ...prev, content: newContent }));
                            }}
                            className="absolute -top-2 -right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove from content"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!featuredImage) {
                                // Promote to featured and remove from content
                                setFeaturedImage(img.url);
                                const newContent = removeImageFromContent(formData.content, img.url);
                                setFormData((prev) => ({ ...prev, content: newContent }));
                              }
                            }}
                            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-xs px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              featuredImage
                                ? 'bg-slate-500 text-slate-400 cursor-not-allowed'
                                : 'bg-amber-600 hover:bg-amber-500 text-white cursor-pointer'
                            }`}
                            title={featuredImage ? 'Remove current featured image first' : 'Make featured image'}
                            disabled={!!featuredImage}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="text-slate-400 text-xs mt-2">
                      Hover to remove or promote to featured (★)
                    </p>
                  </div>
                );
              })()}

              {/* Meta Description */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Meta Description (SEO)
                </label>
                <textarea
                  value={formData.metaDescription}
                  onChange={(e) => updateField('metaDescription', e.target.value)}
                  rows={2}
                  maxLength={160}
                  className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:border-[#FCB514] transition-colors text-sm"
                  placeholder="Brief description for search results (max 160 chars)"
                />
                <p className="text-slate-400 text-xs mt-1">
                  {formData.metaDescription.length}/160 characters
                </p>
              </div>

              {/* Featured Image Section */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  Featured Image
                </label>
                {featuredImage ? (
                  <div className="relative inline-block">
                    <img
                      src={featuredImage}
                      alt="Featured"
                      className="w-full max-w-md h-auto rounded-lg border-2 border-[#FCB514]"
                    />
                    <button
                      type="button"
                      onClick={() => setFeaturedImage(null)}
                      className="absolute top-2 right-2 bg-red-600 hover:bg-red-500 text-white rounded-full p-1.5 transition-colors"
                      title="Remove featured image"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-slate-400 text-sm italic">
                    No featured image set. Upload an image below - the first upload will become the featured image.
                  </p>
                )}
              </div>

              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2">
                  {featuredImage ? 'Add More Images to Content' : 'Image Upload'}
                </label>

                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-[#FCB514] bg-[#FCB514]/10'
                      : 'border-slate-500 hover:border-slate-400'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-600 border-t-[#FCB514]" />
                      <span className="text-slate-400 text-sm">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <ImagePlus className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-slate-400 text-sm mb-2">
                        Drag and drop an image here, or
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <label className="inline-flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg cursor-pointer transition-colors">
                          <Upload className="w-4 h-4" />
                          Upload New
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.gif"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={openGallery}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors"
                        >
                          <Images className="w-4 h-4" />
                          Browse Gallery
                        </button>
                      </div>
                      <p className="text-slate-400 text-xs mt-2">
                        JPG, PNG, WebP, GIF - Max 5MB
                      </p>
                    </>
                  )}
                </div>

                {/* Upload Error */}
                {uploadError && (
                  <div className="mt-2 bg-red-900/30 border border-red-500/50 text-red-300 px-3 py-2 rounded-lg text-sm flex items-center justify-between">
                    <span>{uploadError}</span>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="text-red-400 hover:text-red-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Uploaded Images Gallery */}
                {uploadedImages.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm text-slate-400 mb-2">
                      Uploaded Images (click to insert again):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((url, index) => (
                        <div key={url} className="relative group">
                          <img
                            src={url}
                            alt={`Uploaded ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border border-slate-500 cursor-pointer hover:border-[#FCB514] transition-colors"
                            onClick={() => insertImageAtCursor(url, `Image ${index + 1}`)}
                            title="Click to insert into content"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                            }}
                            className="absolute -top-1 -right-1 bg-slate-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs"
                            title="Copy URL"
                          >
                            <ImagePlus className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Publish Date */}
              <div>
                <label className="block text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  Publish Date
                </label>
                <input
                  type="datetime-local"
                  value={formData.publishedAt}
                  onChange={(e) => updateField('publishedAt', e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-slate-500 rounded-lg text-white focus:outline-none focus:border-[#FCB514] transition-colors"
                />
                <p className="text-slate-400 text-xs mt-1">
                  Leave empty to use current time when publishing. Set a date to backdate or schedule.
                </p>
              </div>

              {/* Pin to Featured */}
              <div className="flex items-center gap-4 p-4 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                <label className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => updateField('pinned', !formData.pinned)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${
                      formData.pinned ? 'bg-amber-500' : 'bg-slate-500'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        formData.pinned ? 'translate-x-5' : ''
                      }`}
                    />
                  </button>
                  <span className="text-slate-300 text-sm font-semibold">Pin to Featured Section</span>
                </label>
                <p className="text-slate-400 text-xs">
                  Pinned posts appear at the top of the blog. Only one post can be pinned at a time.
                </p>
              </div>

              {/* Status Toggle for existing posts */}
              {!isNew && existingPost && (
                <div className="flex items-center gap-4 p-4 bg-slate-700/50 border border-slate-600 rounded-lg">
                  <span className="text-slate-300 text-sm font-semibold">Status:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('status', 'draft')}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        formData.status === 'draft'
                          ? 'bg-amber-500 text-black'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('status', 'published')}
                      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                        formData.status === 'published'
                          ? 'text-black'
                          : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                      }`}
                      style={formData.status === 'published' ? { backgroundColor: accent } : {}}
                    >
                      Published
                    </button>
                  </div>
                  {formData.status !== existingPost.status && (
                    <span className="text-amber-400 text-xs ml-auto">
                      Status will change on save
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center gap-4 pt-4 flex-wrap">
                {isNew ? (
                  <>
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-slate-600 hover:bg-slate-500 transition-colors disabled:opacity-50"
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
                  </>
                ) : (
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-black transition-all duration-300 hover:scale-105 disabled:opacity-50"
                    style={{ backgroundColor: accent }}
                  >
                    <Save className="w-5 h-5" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </button>
                )}

                {/* Fact Check Button */}
                <button
                  type="button"
                  onClick={handleFactCheck}
                  disabled={factChecking || !formData.content.trim()}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-semibold text-white bg-emerald-700 hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed ml-auto"
                  title="Verify facts against live data"
                >
                  {factChecking ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                      Checking...
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-5 h-5" />
                      Verify Facts
                    </>
                  )}
                </button>
              </div>

              {/* Fact Check Error */}
              {factCheckError && (
                <div className="bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg flex items-center justify-between">
                  <span>{factCheckError}</span>
                  <button
                    type="button"
                    onClick={() => setFactCheckError(null)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Fact Check Results Summary */}
              {factCheckResults && !showFactCheckResults && (
                <button
                  type="button"
                  onClick={() => setShowFactCheckResults(true)}
                  className={`w-full p-4 rounded-lg border text-left transition-colors ${
                    factCheckResults.issueCount > 0
                      ? 'border-red-500/50 bg-red-900/20 hover:bg-red-900/30'
                      : factCheckResults.warningCount > 0
                      ? 'border-amber-500/50 bg-amber-900/20 hover:bg-amber-900/30'
                      : 'border-green-500/50 bg-green-900/20 hover:bg-green-900/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {factCheckResults.issueCount > 0 ? (
                      <AlertCircle className="w-5 h-5 text-red-400" />
                    ) : factCheckResults.warningCount > 0 ? (
                      <AlertTriangle className="w-5 h-5 text-amber-400" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                    )}
                    <div>
                      <p className="font-semibold text-white">
                        Fact Check Complete: {factCheckResults.issueCount} issue{factCheckResults.issueCount !== 1 ? 's' : ''}, {factCheckResults.warningCount} warning{factCheckResults.warningCount !== 1 ? 's' : ''}
                      </p>
                      <p className="text-slate-400 text-sm">{factCheckResults.summary}</p>
                    </div>
                    <span className="text-slate-400 ml-auto text-sm">Click to view details</span>
                  </div>
                </button>
              )}
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
                  <p className="text-slate-400 italic">
                    Start typing to see preview...
                  </p>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Image Gallery Modal */}
      {showGallery && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-600 w-full max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-600">
              <h3
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'Bebas Neue, sans-serif' }}
              >
                Image Gallery
              </h3>
              <button
                type="button"
                onClick={() => setShowGallery(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingGallery ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-600 border-t-[#FCB514]" />
                </div>
              ) : galleryError ? (
                <div className="text-center py-12">
                  <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
                  <p className="text-red-400 font-semibold">Failed to load gallery</p>
                  <p className="text-slate-400 text-sm mt-1">{galleryError}</p>
                  <button
                    type="button"
                    onClick={loadGalleryImages}
                    className="mt-4 px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              ) : galleryImages.length === 0 ? (
                <div className="text-center py-12">
                  <Images className="w-16 h-16 text-slate-500 mx-auto mb-4" />
                  <p className="text-slate-400">No images uploaded yet</p>
                  <p className="text-slate-500 text-sm mt-1">
                    Upload images to build your gallery
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {galleryImages.map((image) => (
                    <div
                      key={image.url}
                      className="relative group aspect-square rounded-lg overflow-hidden border border-slate-600 hover:border-[#FCB514] transition-colors cursor-pointer"
                    >
                      <img
                        src={image.url}
                        alt={image.filename}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                        {!featuredImage && (
                          <button
                            type="button"
                            onClick={() => selectFromGallery(image.url, true)}
                            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded transition-colors w-full"
                          >
                            Set as Featured
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => selectFromGallery(image.url, false)}
                          className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white text-xs font-semibold rounded transition-colors w-full"
                        >
                          Insert in Content
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-600 text-center">
              <p className="text-slate-400 text-sm">
                {galleryError
                  ? 'Unable to load gallery'
                  : `${galleryImages.length} image${galleryImages.length !== 1 ? 's' : ''} in gallery`}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fact Check Results Modal */}
      {showFactCheckResults && factCheckResults && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-2xl border border-slate-600 w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-600">
              <div className="flex items-center gap-3">
                <ShieldCheck className="w-6 h-6 text-emerald-400" />
                <h3
                  className="text-xl font-bold text-white"
                  style={{ fontFamily: 'Bebas Neue, sans-serif' }}
                >
                  Fact Check Results
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFactCheckResults(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Summary */}
            <div className={`p-4 border-b border-slate-600 ${
              factCheckResults.issueCount > 0
                ? 'bg-red-900/20'
                : factCheckResults.warningCount > 0
                ? 'bg-amber-900/20'
                : 'bg-green-900/20'
            }`}>
              <div className="flex items-center gap-4 mb-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="text-red-400 font-semibold">{factCheckResults.issueCount} Issues</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span className="text-amber-400 font-semibold">{factCheckResults.warningCount} Warnings</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                  <span className="text-green-400 font-semibold">
                    {factCheckResults.findings.filter(f => f.category === 'verified').length} Verified
                  </span>
                </div>
              </div>
              <p className="text-white">{factCheckResults.summary}</p>
              <p className="text-slate-400 text-sm mt-2">
                Data source: {factCheckResults.verifiedDataSummary.team.toUpperCase()} |
                Record: {factCheckResults.verifiedDataSummary.record} |
                Roster: {factCheckResults.verifiedDataSummary.rosterCount} players
                {factCheckResults.verifiedDataSummary.hasGameData && ' | Game data included'}
              </p>
            </div>

            {/* Findings List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {factCheckResults.findings.length === 0 ? (
                <div className="text-center py-8">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-white font-semibold">No findings to report</p>
                  <p className="text-slate-400 text-sm">The article appears to be factually accurate</p>
                </div>
              ) : (
                factCheckResults.findings.map((finding, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border ${getCategoryColor(finding.category)}`}
                  >
                    <div className="flex items-start gap-3">
                      {getCategoryIcon(finding.category)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${
                            finding.category === 'verified' ? 'bg-green-500/20 text-green-400' :
                            finding.category === 'issue' ? 'bg-red-500/20 text-red-400' :
                            finding.category === 'warning' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-slate-500/20 text-slate-400'
                          }`}>
                            {finding.category}
                          </span>
                        </div>
                        <p className="text-white text-sm mb-2">
                          <span className="text-slate-400">Claim: </span>
                          "{finding.claim}"
                        </p>
                        <p className="text-slate-300 text-sm">{finding.explanation}</p>
                        {finding.correction && (
                          <p className="text-green-400 text-sm mt-2">
                            <span className="font-semibold">Correction: </span>
                            {finding.correction}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-600 flex items-center justify-between">
              <p className="text-slate-400 text-sm">
                {factCheckResults.findings.length} finding{factCheckResults.findings.length !== 1 ? 's' : ''} analyzed
              </p>
              <button
                type="button"
                onClick={() => setShowFactCheckResults(false)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-500 text-white rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
