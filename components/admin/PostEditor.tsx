'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, Eye, EyeOff, Send, Sparkles, ImagePlus, X, Upload, Calendar, Images, ShieldCheck, AlertTriangle, CheckCircle2, HelpCircle, AlertCircle, RefreshCw, Image as ImageIcon } from 'lucide-react';
import { fetchPost, createPost, updatePost, generateArticle, uploadImage, fetchImages, factCheckArticle, type FactCheckResponse, type FactCheckFinding } from '@/lib/services/blogApi';
import { fetchSabresSchedule } from '@/lib/services/nhlApi';
import { calculateChunks } from '@/lib/utils/chunkCalculator';
import PostContent from '@/components/blog/PostContent';
import { Card, SectionHeading, Button, Toggle, Badge, Spinner, ErrorBanner, Input, Textarea, Select, Field, Modal } from '@/components/admin/ui';
import type { BlogPost, GameChunk } from '@/lib/types';

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
  team: string;
  type: 'game-recap' | 'set-recap' | 'custom' | 'weekly-roundup' | 'news-analysis' | 'playoff-game-recap' | 'series-recap';
  status: 'draft' | 'published';
  opponent: string;
  gameDate: string;
  gameId?: number;
  setNumber?: number;
  metaDescription: string;
  publishedAt: string;
  pinned: boolean;
};

const teamConfig: Record<string, { accent: string }> = {
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
  const params = useParams();
  const slug = params?.slug as string | undefined;
  const router = useRouter();
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

  // Publish button sets this synchronously before the form submits, so the
  // submit handler never reads a stale status out of React state.
  const statusOverrideRef = useRef<'published' | null>(null);

  // AI generation state
  const [articleIdea, setArticleIdea] = useState('');
  const [researchEnabled, setResearchEnabled] = useState(false);
  const [customizeResearch, setCustomizeResearch] = useState(false);
  const [customDomains, setCustomDomains] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatingCard, setGeneratingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
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
        const chunks = calculateChunks(schedule, schedule.length > 0 ? schedule.length : 82);
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

    // Read the override synchronously — no setState race on Publish
    const status = statusOverrideRef.current ?? formData.status;
    statusOverrideRef.current = null;

    try {
      // Convert datetime-local to ISO for API
      const publishedAtISO = datetimeLocalToIso(formData.publishedAt) || undefined;

      if (isNew) {
        const result = await createPost({
          title: formData.title,
          content: formData.content,
          team: formData.team,
          type: formData.type,
          status,
          opponent: formData.opponent || undefined,
          gameDate: formData.gameDate || undefined,
          gameId: formData.gameId || undefined,
          metaDescription: formData.metaDescription || undefined,
          ogImage: featuredImage || undefined,
          publishedAt: publishedAtISO,
          pinned: formData.pinned,
        });
        notifyTweetResult(result.tweet);
        router.push(`/admin/posts/${result.post.slug}`);
      } else if (existingPost) {
        const result = await updatePost(existingPost.slug, {
          title: formData.title,
          content: formData.content,
          status,
          opponent: formData.opponent || undefined,
          gameDate: formData.gameDate || undefined,
          metaDescription: formData.metaDescription || undefined,
          ogImage: featuredImage || undefined,
          publishedAt: publishedAtISO,
          pinned: formData.pinned,
        });
        notifyTweetResult(result.tweet);
      }
      router.push('/admin/posts');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post');
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateCard() {
    if (!formData.title.trim()) return;
    setGeneratingCard(true);
    setCardError(null);
    try {
      const response = await fetch('/api/blog/generate-card', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ title: formData.title, team: formData.team }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to generate card');
      }
      setFeaturedImage(data.url);
    } catch (err) {
      setCardError(err instanceof Error ? err.message : 'Failed to generate card');
    } finally {
      setGeneratingCard(false);
    }
  }

  function notifyTweetResult(tweet?: { success: boolean; tweetId?: string; error?: string; skipped?: string }) {
    if (!tweet || tweet.skipped) return;
    if (tweet.success) {
      alert('Post published and shared to X.');
    } else {
      alert(`Post published, but sharing to X failed: ${tweet.error || 'unknown error'}\n\nYou can share it manually from the posts list.`);
    }
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
        return <CheckCircle2 className="w-4 h-4 text-green-600" />;
      case 'issue':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500" />;
      case 'unverifiable':
        return <HelpCircle className="w-4 h-4 text-gray-400" />;
    }
  }

  function getCategoryColor(category: FactCheckFinding['category']) {
    switch (category) {
      case 'verified':
        return 'border-green-200 bg-green-50';
      case 'issue':
        return 'border-red-200 bg-red-50';
      case 'warning':
        return 'border-amber-200 bg-amber-50';
      case 'unverifiable':
        return 'border-gray-200 bg-gray-50';
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Spinner size="lg" />
      </div>
    );
  }

  const accent = (teamConfig[formData.team] || teamConfig.sabres).accent;

  return (
    <>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {/* Sub-header */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link
              href="/admin/posts"
              className="flex items-center gap-2 text-sm text-gray-500 transition-colors hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Posts
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">
              {isNew ? 'New Post' : 'Edit Post'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="ghost" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? (
                <>
                  <EyeOff className="h-4 w-4" />
                  Hide Preview
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" />
                  Preview
                </>
              )}
            </Button>
            {isNew ? (
              <>
                <Button type="submit" form="post-editor-form" variant="secondary" disabled={saving}>
                  <Save className="h-4 w-4" />
                  {saving ? 'Saving...' : 'Save Draft'}
                </Button>
                <Button
                  type="submit"
                  form="post-editor-form"
                  variant="primary"
                  disabled={saving}
                  onClick={() => {
                    statusOverrideRef.current = 'published';
                  }}
                >
                  <Send className="h-4 w-4" />
                  {saving ? 'Publishing...' : 'Publish'}
                </Button>
              </>
            ) : (
              <Button type="submit" form="post-editor-form" variant="primary" disabled={saving}>
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorBanner>{error}</ErrorBanner>
          </div>
        )}

        <div className={`grid gap-8 ${showPreview ? 'lg:grid-cols-2' : ''}`}>
          {/* Editor */}
          <form id="post-editor-form" onSubmit={handleSubmit} className="space-y-6">
            <Card className="space-y-6">
              {/* Title */}
              <Field label="Title">
                <Input
                  type="text"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  placeholder="Post title"
                  required
                />
              </Field>

              {/* Team & Type (only for new posts) */}
              {isNew && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Team">
                    <Select
                      value={formData.team}
                      onChange={(e) => updateField('team', e.target.value as 'sabres' | 'bills')}
                    >
                      <option value="sabres">Sabres</option>
                      <option value="bills">Bills</option>
                    </Select>
                  </Field>
                  <Field label="Type">
                    <Select
                      value={formData.type}
                      onChange={(e) =>
                        updateField('type', e.target.value as 'game-recap' | 'set-recap' | 'custom')
                      }
                    >
                      <option value="custom">Custom Article</option>
                      <option value="game-recap">Game Recap</option>
                      <option value="set-recap">Set Recap</option>
                    </Select>
                  </Field>
                </div>
              )}

              {/* AI Article Generator - Only for new custom articles */}
              {isNew && formData.type === 'custom' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-base font-bold text-gray-900">
                      <Sparkles className="h-5 w-5 text-indigo-500" />
                      AI Article Generator
                    </h3>
                    <Toggle
                      checked={researchEnabled}
                      onChange={() => setResearchEnabled(!researchEnabled)}
                      label="Research"
                    />
                  </div>

                  {/* Reference Date - Show when research is enabled */}
                  {researchEnabled && (
                    <div className="mb-4 flex items-center gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <span className="text-sm font-semibold text-sabres-blue">Reference Date:</span>
                      <span className="text-sm text-gray-900">{referenceDate}</span>
                      <span className="ml-auto text-xs text-gray-500">
                        AI will search for data from this date
                      </span>
                    </div>
                  )}

                  <div className="mb-4">
                    <Field label="Article Idea / Instructions">
                      <Textarea
                        value={articleIdea}
                        onChange={(e) => setArticleIdea(e.target.value)}
                        rows={4}
                        placeholder="Describe what you want the article to cover. Be specific about topics, players, stats, comparisons, or themes you want included..."
                      />
                    </Field>
                    <p className="mt-1 text-xs text-gray-500">
                      {researchEnabled
                        ? 'Research mode: AI will search the web for current stats and information.'
                        : "Tip: Enable 'Research' for AI to look up current stats and news."}
                    </p>
                  </div>

                  {/* Research Sources - Only show when research is enabled */}
                  {researchEnabled && (
                    <div className="mb-4 rounded-lg border border-indigo-100 bg-white p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-sm font-semibold text-gray-700">
                          Research Sources
                        </span>
                        <button
                          type="button"
                          onClick={() => setCustomizeResearch(!customizeResearch)}
                          className="text-xs text-indigo-600 transition-colors hover:text-indigo-700"
                        >
                          {customizeResearch ? 'Use Defaults' : 'Customize'}
                        </button>
                      </div>

                      {customizeResearch ? (
                        <div>
                          <Textarea
                            value={customDomains}
                            onChange={(e) => setCustomDomains(e.target.value)}
                            rows={3}
                            className="font-mono text-xs"
                            placeholder="Enter domains (comma or newline separated)&#10;e.g., nhl.com, espn.com"
                          />
                          <p className="mt-1 text-xs text-gray-500">
                            AI will only search these domains
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {DEFAULT_RESEARCH_DOMAINS.map((domain) => (
                            <Badge key={domain} variant="info">
                              {domain}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {generateError && (
                    <div className="mb-4">
                      <ErrorBanner>{generateError}</ErrorBanner>
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
                        <div className="h-full animate-pulse bg-indigo-500" style={{ width: '100%' }} />
                      </div>
                      <p className="mt-2 text-center text-sm text-gray-500">
                        Generating your article... This may take 15-30 seconds.
                      </p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateArticle}
                    disabled={generating || !articleIdea.trim()}
                  >
                    {generating ? (
                      <>
                        <Spinner size="sm" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Draft
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Game Recap: Game Selector and AI Generator */}
              {isNew && formData.type === 'game-recap' && formData.team === 'sabres' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    AI Game Recap Generator
                  </h3>

                  {/* Game Selector */}
                  <div className="mb-4">
                    <Field label="Select Game">
                      {loadingGames ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Spinner size="sm" />
                          Loading recent games...
                        </div>
                      ) : recentGames.length > 0 ? (
                        <Select
                          value={formData.gameId || ''}
                          onChange={(e) => handleGameSelect(e.target.value)}
                        >
                          <option value="">Select a game...</option>
                          {recentGames.map((g) => (
                            <option key={g.gameId} value={g.gameId}>
                              {g.date}: {g.outcome} {g.sabresScore}-{g.opponentScore} {g.isHome ? 'vs' : '@'} {g.opponent}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <p className="text-sm text-gray-500">No recent games found</p>
                      )}
                    </Field>
                  </div>

                  {/* Selected Game Info */}
                  {formData.gameId && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-500">Opponent:</span>
                          <span className="ml-2 text-gray-900">{formData.opponent}</span>
                        </div>
                        <div>
                          <span className="text-gray-500">Date:</span>
                          <span className="ml-2 text-gray-900">{formData.gameDate}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {generateError && (
                    <div className="mb-4">
                      <ErrorBanner>{generateError}</ErrorBanner>
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
                        <div className="h-full animate-pulse bg-indigo-500" style={{ width: '100%' }} />
                      </div>
                      <p className="mt-2 text-center text-sm text-gray-500">
                        Fetching box score and generating recap...
                      </p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateRecap}
                    disabled={generating || !formData.gameId}
                  >
                    {generating ? (
                      <>
                        <Spinner size="sm" />
                        Generating Recap...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Recap
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Set Recap: Set Selector and AI Generator */}
              {isNew && formData.type === 'set-recap' && formData.team === 'sabres' && (
                <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-5">
                  <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
                    <Sparkles className="h-5 w-5 text-indigo-500" />
                    AI Set Recap Generator
                  </h3>

                  {/* Set Selector */}
                  <div className="mb-4">
                    <Field label="Select Set">
                      {loadingSets ? (
                        <div className="flex items-center gap-2 text-gray-500">
                          <Spinner size="sm" />
                          Loading completed sets...
                        </div>
                      ) : completedSets.length > 0 ? (
                        <Select
                          value={formData.setNumber || ''}
                          onChange={(e) => handleSetSelect(e.target.value)}
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
                        </Select>
                      ) : (
                        <p className="text-sm text-gray-500">No completed sets found</p>
                      )}
                    </Field>
                  </div>

                  {/* Selected Set Info */}
                  {formData.setNumber && (
                    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
                      {(() => {
                        const selectedSet = completedSets.find((s) => s.chunkNumber === formData.setNumber);
                        if (!selectedSet) return null;
                        const pointsPct = ((selectedSet.points / selectedSet.maxPoints) * 100).toFixed(0);
                        return (
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-gray-500">Set:</span>
                              <span className="ml-2 text-gray-900">#{formData.setNumber}</span>
                            </div>
                            <div>
                              <span className="text-gray-500">Record:</span>
                              <span className="ml-2 text-gray-900">
                                {selectedSet.wins}-{selectedSet.losses}-{selectedSet.otLosses}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Points:</span>
                              <span className="ml-2 text-gray-900">
                                {selectedSet.points}/{selectedSet.maxPoints} ({pointsPct}%)
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-500">Opponents:</span>
                              <span className="ml-2 text-gray-900">{formData.opponent}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {generateError && (
                    <div className="mb-4">
                      <ErrorBanner>{generateError}</ErrorBanner>
                    </div>
                  )}

                  {generating && (
                    <div className="mb-4">
                      <div className="h-2 overflow-hidden rounded-full bg-indigo-100">
                        <div className="h-full animate-pulse bg-indigo-500" style={{ width: '100%' }} />
                      </div>
                      <p className="mt-2 text-center text-sm text-gray-500">
                        Fetching game data and generating set recap...
                      </p>
                    </div>
                  )}

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={handleGenerateSetRecap}
                    disabled={generating || !formData.setNumber}
                  >
                    {generating ? (
                      <>
                        <Spinner size="sm" />
                        Generating Set Recap...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        Generate Set Recap
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Manual Opponent & Date (for Bills game recaps only) */}
              {(formData.type === 'game-recap' && formData.team === 'bills') && (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Opponent">
                    <Input
                      type="text"
                      value={formData.opponent}
                      onChange={(e) => updateField('opponent', e.target.value)}
                      placeholder="e.g., Rangers"
                    />
                  </Field>
                  <Field label="Game Date">
                    <Input
                      type="date"
                      value={formData.gameDate}
                      onChange={(e) => updateField('gameDate', e.target.value)}
                    />
                  </Field>
                </div>
              )}

              {/* Content */}
              <Field label="Content (Markdown)">
                <Textarea
                  value={formData.content}
                  onChange={(e) => updateField('content', e.target.value)}
                  rows={20}
                  className="font-mono text-sm"
                  placeholder="Write your post content in Markdown..."
                  required
                />
              </Field>

              {/* Content Images Gallery */}
              {(() => {
                const contentImages = extractImagesFromContent(formData.content);
                if (contentImages.length === 0) return null;
                return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <p className="mb-3 text-sm font-semibold text-gray-700">
                      Images in Content ({contentImages.length})
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {contentImages.map((img, index) => (
                        <div key={img.url} className="group relative">
                          <img
                            src={img.url}
                            alt={img.alt || `Image ${index + 1}`}
                            className="h-20 w-20 rounded-lg border border-gray-300 object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const newContent = removeImageFromContent(formData.content, img.url);
                              setFormData((prev) => ({ ...prev, content: newContent }));
                            }}
                            className="absolute -right-2 -top-2 rounded-full bg-red-600 p-1 text-white opacity-0 transition-opacity hover:bg-red-500 group-hover:opacity-100"
                            title="Remove from content"
                          >
                            <X className="h-3 w-3" />
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
                            className={`absolute -bottom-2 left-1/2 -translate-x-1/2 rounded px-2 py-0.5 text-xs opacity-0 transition-opacity group-hover:opacity-100 ${
                              featuredImage
                                ? 'cursor-not-allowed bg-gray-300 text-gray-500'
                                : 'cursor-pointer bg-amber-500 text-white hover:bg-amber-400'
                            }`}
                            title={featuredImage ? 'Remove current featured image first' : 'Make featured image'}
                            disabled={!!featuredImage}
                          >
                            ★
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Hover to remove or promote to featured (★)
                    </p>
                  </div>
                );
              })()}

              {/* Meta Description */}
              <div>
                <Field label="Meta Description (SEO)">
                  <Textarea
                    value={formData.metaDescription}
                    onChange={(e) => updateField('metaDescription', e.target.value)}
                    rows={2}
                    maxLength={160}
                    placeholder="Brief description for search results (max 160 chars)"
                  />
                </Field>
                <p className="mt-1 text-xs text-gray-500">
                  {formData.metaDescription.length}/160 characters
                </p>
              </div>
            </Card>

            <Card className="space-y-6">
              {/* Featured Image Section */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Featured Image
                </p>
                {featuredImage ? (
                  <div className="relative inline-block">
                    <img
                      src={featuredImage}
                      alt="Featured"
                      className="h-auto w-full max-w-md rounded-lg border-2 border-sabres-blue"
                    />
                    <button
                      type="button"
                      onClick={() => setFeaturedImage(null)}
                      className="absolute right-2 top-2 rounded-full bg-red-600 p-1.5 text-white transition-colors hover:bg-red-500"
                      title="Remove featured image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm italic text-gray-500">
                      No featured image set. Generate a card from the title, or upload an image below.
                    </p>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={handleGenerateCard}
                      disabled={generatingCard || !formData.title.trim()}
                      title={formData.title.trim() ? 'Generate a team-branded card image from the post title' : 'Enter a title first'}
                    >
                      {generatingCard ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      Generate Card from Title
                    </Button>
                    {cardError && <p className="text-sm text-red-500">{cardError}</p>}
                  </div>
                )}
              </div>

              {/* Image Upload Section */}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {featuredImage ? 'Add More Images to Content' : 'Image Upload'}
                </p>

                {/* Drop Zone */}
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    isDragging
                      ? 'border-sabres-blue bg-blue-50'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Spinner size="lg" />
                      <span className="text-sm text-gray-500">Uploading...</span>
                    </div>
                  ) : (
                    <>
                      <ImagePlus className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="mb-2 text-sm text-gray-500">
                        Drag and drop an image here, or
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50">
                          <Upload className="h-4 w-4" />
                          Upload New
                          <input
                            type="file"
                            accept=".jpg,.jpeg,.png,.webp,.gif"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </label>
                        <Button type="button" variant="secondary" onClick={openGallery}>
                          <Images className="h-4 w-4" />
                          Browse Gallery
                        </Button>
                      </div>
                      <p className="mt-2 text-xs text-gray-400">
                        JPG, PNG, WebP, GIF - Max 5MB
                      </p>
                    </>
                  )}
                </div>

                {/* Upload Error */}
                {uploadError && (
                  <div className="mt-2 flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    <span>{uploadError}</span>
                    <button
                      type="button"
                      onClick={() => setUploadError(null)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Uploaded Images Gallery */}
                {uploadedImages.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-sm text-gray-500">
                      Uploaded Images (click to insert again):
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {uploadedImages.map((url, index) => (
                        <div key={url} className="group relative">
                          <img
                            src={url}
                            alt={`Uploaded ${index + 1}`}
                            className="h-16 w-16 cursor-pointer rounded border border-gray-300 object-cover transition-colors hover:border-sabres-blue"
                            onClick={() => insertImageAtCursor(url, `Image ${index + 1}`)}
                            title="Click to insert into content"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(url);
                            }}
                            className="absolute -right-1 -top-1 rounded-full bg-gray-600 p-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100"
                            title="Copy URL"
                          >
                            <ImagePlus className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            <Card className="space-y-6">
              {/* Publish Date */}
              <div>
                <Field
                  label={
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      Publish Date
                    </span>
                  }
                >
                  <Input
                    type="datetime-local"
                    value={formData.publishedAt}
                    onChange={(e) => updateField('publishedAt', e.target.value)}
                  />
                </Field>
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use current time when publishing. Set a date to backdate or schedule.
                </p>
              </div>

              {/* Pin to Featured */}
              <div className="flex items-center gap-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <Toggle
                  checked={formData.pinned}
                  onChange={() => updateField('pinned', !formData.pinned)}
                  label={<span className="font-semibold">Pin to Featured Section</span>}
                />
                <p className="text-xs text-gray-500">
                  Pinned posts appear at the top of the blog. Only one post can be pinned at a time.
                </p>
              </div>

              {/* Status Toggle for existing posts */}
              {!isNew && existingPost && (
                <div className="flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <span className="text-sm font-semibold text-gray-700">Status:</span>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => updateField('status', 'draft')}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                        formData.status === 'draft'
                          ? 'bg-amber-500 text-white'
                          : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Draft
                    </button>
                    <button
                      type="button"
                      onClick={() => updateField('status', 'published')}
                      className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                        formData.status === 'published'
                          ? 'bg-green-600 text-white'
                          : 'bg-white text-gray-600 ring-1 ring-gray-300 hover:bg-gray-100'
                      }`}
                    >
                      Published
                    </button>
                  </div>
                  {formData.status !== existingPost.status && (
                    <Badge variant="warning" className="ml-auto">
                      Status will change on save
                    </Badge>
                  )}
                </div>
              )}
            </Card>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-4 pt-2">
              {/* Fact Check Button */}
              <button
                type="button"
                onClick={handleFactCheck}
                disabled={factChecking || !formData.content.trim()}
                className="ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                title="Verify facts against live data"
              >
                {factChecking ? (
                  <>
                    <Spinner size="sm" className="!border-white/30 !border-t-white" />
                    Checking...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="h-4 w-4" />
                    Verify Facts
                  </>
                )}
              </button>
            </div>

            {/* Fact Check Error */}
            {factCheckError && (
              <div className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <span>{factCheckError}</span>
                <button
                  type="button"
                  onClick={() => setFactCheckError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Fact Check Results Summary */}
            {factCheckResults && !showFactCheckResults && (
              <button
                type="button"
                onClick={() => setShowFactCheckResults(true)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  factCheckResults.issueCount > 0
                    ? 'border-red-200 bg-red-50 hover:bg-red-100'
                    : factCheckResults.warningCount > 0
                    ? 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                    : 'border-green-200 bg-green-50 hover:bg-green-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {factCheckResults.issueCount > 0 ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : factCheckResults.warningCount > 0 ? (
                    <AlertTriangle className="h-5 w-5 text-amber-500" />
                  ) : (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      Fact Check Complete: {factCheckResults.issueCount} issue{factCheckResults.issueCount !== 1 ? 's' : ''}, {factCheckResults.warningCount} warning{factCheckResults.warningCount !== 1 ? 's' : ''}
                    </p>
                    <p className="text-sm text-gray-500">{factCheckResults.summary}</p>
                  </div>
                  <span className="ml-auto text-sm text-gray-400">Click to view details</span>
                </div>
              </button>
            )}
          </form>

          {/* Preview */}
          {showPreview && (
            <Card className="max-h-[calc(100vh-200px)] self-start overflow-auto">
              <SectionHeading>Preview</SectionHeading>
              {formData.title && (
                <h3 className="mb-6 text-3xl font-bold text-gray-900">
                  {formData.title}
                </h3>
              )}
              {formData.content ? (
                <PostContent content={formData.content} accent={accent} />
              ) : (
                <p className="italic text-gray-400">
                  Start typing to see preview...
                </p>
              )}
            </Card>
          )}
        </div>
      </main>

      {/* Image Gallery Modal */}
      {showGallery && (
        <Modal onClose={() => setShowGallery(false)} title="Image Gallery" wide>
          {loadingGallery ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : galleryError ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
              <p className="font-semibold text-red-600">Failed to load gallery</p>
              <p className="mt-1 text-sm text-gray-500">{galleryError}</p>
              <Button type="button" variant="ghost" className="mt-4" onClick={loadGalleryImages}>
                Try Again
              </Button>
            </div>
          ) : galleryImages.length === 0 ? (
            <div className="py-12 text-center">
              <Images className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <p className="text-gray-500">No images uploaded yet</p>
              <p className="mt-1 text-sm text-gray-400">
                Upload images to build your gallery
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {galleryImages.map((image) => (
                <div
                  key={image.url}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg border border-gray-200 transition-colors hover:border-sabres-blue"
                >
                  <img
                    src={image.url}
                    alt={image.filename}
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                    {!featuredImage && (
                      <button
                        type="button"
                        onClick={() => selectFromGallery(image.url, true)}
                        className="w-full rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-400"
                      >
                        Set as Featured
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => selectFromGallery(image.url, false)}
                      className="w-full rounded bg-white px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-100"
                    >
                      Insert in Content
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-4 border-t border-gray-100 pt-3 text-center text-sm text-gray-400">
            {galleryError
              ? 'Unable to load gallery'
              : `${galleryImages.length} image${galleryImages.length !== 1 ? 's' : ''} in gallery`}
          </p>
        </Modal>
      )}

      {/* Fact Check Results Modal */}
      {showFactCheckResults && factCheckResults && (
        <Modal
          onClose={() => setShowFactCheckResults(false)}
          title={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-600" />
              Fact Check Results
            </span>
          }
          wide
        >
          {/* Summary */}
          <div
            className={`mb-4 rounded-lg border p-4 ${
              factCheckResults.issueCount > 0
                ? 'border-red-200 bg-red-50'
                : factCheckResults.warningCount > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-green-200 bg-green-50'
            }`}
          >
            <div className="mb-2 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <span className="text-sm font-semibold text-red-600">{factCheckResults.issueCount} Issues</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <span className="text-sm font-semibold text-amber-600">{factCheckResults.warningCount} Warnings</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span className="text-sm font-semibold text-green-700">
                  {factCheckResults.findings.filter(f => f.category === 'verified').length} Verified
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-900">{factCheckResults.summary}</p>
            <p className="mt-2 text-xs text-gray-500">
              Data source: {factCheckResults.verifiedDataSummary.team.toUpperCase()} |
              Record: {factCheckResults.verifiedDataSummary.record} |
              Roster: {factCheckResults.verifiedDataSummary.rosterCount} players
              {factCheckResults.verifiedDataSummary.hasGameData && ' | Game data included'}
            </p>
          </div>

          {/* Findings List */}
          <div className="max-h-[45vh] space-y-3 overflow-y-auto">
            {factCheckResults.findings.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-green-500" />
                <p className="font-semibold text-gray-900">No findings to report</p>
                <p className="text-sm text-gray-500">The article appears to be factually accurate</p>
              </div>
            ) : (
              factCheckResults.findings.map((finding, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-4 ${getCategoryColor(finding.category)}`}
                >
                  <div className="flex items-start gap-3">
                    {getCategoryIcon(finding.category)}
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge
                          variant={
                            finding.category === 'verified' ? 'success' :
                            finding.category === 'issue' ? 'error' :
                            finding.category === 'warning' ? 'warning' : 'neutral'
                          }
                          className="uppercase"
                        >
                          {finding.category}
                        </Badge>
                      </div>
                      <p className="mb-2 text-sm text-gray-900">
                        <span className="text-gray-500">Claim: </span>
                        &quot;{finding.claim}&quot;
                      </p>
                      <p className="text-sm text-gray-600">{finding.explanation}</p>
                      {finding.correction && (
                        <p className="mt-2 text-sm text-green-700">
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

          {/* Footer */}
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <p className="text-sm text-gray-400">
              {factCheckResults.findings.length} finding{factCheckResults.findings.length !== 1 ? 's' : ''} analyzed
            </p>
            <Button type="button" variant="ghost" onClick={() => setShowFactCheckResults(false)}>
              Close
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
