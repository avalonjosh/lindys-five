import { useState, useEffect } from 'react';
import { RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { Modal, Button, Textarea } from './ui';
import type { BlogPost } from '@/lib/types';

interface ShareToXModalProps {
  post: BlogPost;
  onClose: () => void;
}

export default function ShareToXModal({ post, onClose }: ShareToXModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tweetText, setTweetText] = useState('');
  const [copied, setCopied] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postedTweetId, setPostedTweetId] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);

  // Character count (X allows 280 characters)
  const charCount = tweetText.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;

  // Generate tweet on mount
  useEffect(() => {
    generateTweet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function generateTweet() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/blog/generate-tweet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: post.title,
          excerpt: post.excerpt,
          content: post.content,
          team: post.team,
          type: post.type,
          slug: post.slug,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate tweet');
      }

      const data = await response.json();
      setTweetText(data.tweet);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate tweet');
      // Fallback tweet
      const hashtags = post.team === 'sabres' ? '#Sabres #LetsGoBuffalo #NHL' : '#Bills #GoBills #NFL';
      setTweetText(`${post.title}\n\nhttps://www.lindysfive.com/blog/${post.team}/${post.slug}\n\n${hashtags}`);
    } finally {
      setLoading(false);
    }
  }

  async function handlePostToX() {
    setPosting(true);
    setPostError(null);
    try {
      const response = await fetch('/api/blog/post-to-x', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ slug: post.slug, fullTweet: tweetText }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to post to X');
      }
      setPostedTweetId(data.tweetId || 'posted');
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Failed to post to X');
    } finally {
      setPosting(false);
    }
  }

  function handleOpenComposer() {
    // Fallback: open X's compose window with the text pre-filled
    const encoded = encodeURIComponent(tweetText);
    const xUrl = `https://twitter.com/intent/tweet?text=${encoded}`;
    window.open(xUrl, '_blank', 'width=550,height=420');
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(tweetText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }

  return (
    <Modal
      onClose={onClose}
      title={
        <span className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-black text-sm font-bold text-white">X</span>
          Share to X
        </span>
      }
      wide
    >
      {/* Post info */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-gray-50 p-3">
        <p className="mb-0.5 text-xs text-gray-500">Sharing:</p>
        <p className="truncate text-sm font-medium text-gray-900">{post.title}</p>
      </div>

      {/* Tweet textarea */}
      <div className="relative">
        <Textarea
          value={tweetText}
          onChange={(e) => setTweetText(e.target.value)}
          disabled={loading}
          className={`h-44 resize-none ${isOverLimit ? '!border-red-400 !ring-red-200' : ''}`}
          placeholder="Your tweet will appear here..."
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-white/80">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>Generating tweet...</span>
            </div>
          </div>
        )}
      </div>

      {/* Character count */}
      <div className="mt-2 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={generateTweet}
            disabled={loading}
            className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Regenerate
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                Copy
              </>
            )}
          </button>
        </div>
        <span className={`text-sm ${isOverLimit ? 'font-semibold text-red-500' : 'text-gray-400'}`}>
          {charCount}/{maxChars}
        </span>
      </div>

      {/* Error message */}
      {error && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{error}</p>
          <p className="mt-1 text-xs text-red-400">A fallback tweet has been generated.</p>
        </div>
      )}

      {/* Post result */}
      {postedTweetId && (
        <div className="mt-3 rounded-lg border border-green-200 bg-green-50 p-3">
          <p className="text-sm font-semibold text-green-700">Posted to X!</p>
          {postedTweetId !== 'posted' && (
            <a
              href={`https://x.com/i/web/status/${postedTweetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-600 underline hover:text-green-700"
            >
              View tweet
            </a>
          )}
        </div>
      )}
      {postError && (
        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-600">{postError}</p>
          <p className="mt-1 text-xs text-red-400">
            You can still use &quot;Open composer&quot; to post manually.
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
        <Button variant="ghost" onClick={onClose}>
          {postedTweetId ? 'Done' : 'Cancel'}
        </Button>
        <Button
          variant="secondary"
          onClick={handleOpenComposer}
          disabled={loading || isOverLimit}
          title="Open X's compose window to post manually"
        >
          Open composer
          <ExternalLink className="h-4 w-4" />
        </Button>
        <Button
          onClick={handlePostToX}
          disabled={loading || posting || isOverLimit || !!postedTweetId}
          className="!bg-black !text-white hover:!bg-zinc-800"
        >
          {posting ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Posting...
            </>
          ) : (
            <span>{postedTweetId ? 'Posted' : 'Post to X'}</span>
          )}
        </Button>
      </div>
    </Modal>
  );
}
