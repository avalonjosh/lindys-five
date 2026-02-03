import { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import type { BlogPost } from '../../types';

interface ShareToXModalProps {
  post: BlogPost;
  onClose: () => void;
}

export default function ShareToXModal({ post, onClose }: ShareToXModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tweetText, setTweetText] = useState('');
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Character count (X allows 280 characters)
  const charCount = tweetText.length;
  const maxChars = 280;
  const isOverLimit = charCount > maxChars;

  // Generate tweet on mount
  useEffect(() => {
    generateTweet();
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
      setTweetText(`${post.title}\n\nhttps://lindysfive.com/blog/${post.team}/${post.slug}\n\n${hashtags}`);
    } finally {
      setLoading(false);
    }
  }

  function handleShare() {
    // URL encode the tweet text
    const encoded = encodeURIComponent(tweetText);
    // Open X compose window
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

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-lg bg-slate-700 rounded-2xl shadow-2xl border-2 border-slate-500 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800 border-b border-slate-600">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">X</span>
            </div>
            <h2 className="text-xl font-bold text-white" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
              Share to X
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white transition-colors rounded-lg hover:bg-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Post info */}
          <div className="mb-4 p-3 bg-slate-800/50 rounded-lg border border-slate-600">
            <p className="text-sm text-slate-400 mb-1">Sharing:</p>
            <p className="text-white font-medium truncate">{post.title}</p>
          </div>

          {/* Tweet textarea */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              value={tweetText}
              onChange={(e) => setTweetText(e.target.value)}
              disabled={loading}
              className={`w-full h-48 p-4 bg-slate-800 border-2 rounded-xl text-white resize-none focus:outline-none focus:border-[#FCB514] transition-colors ${
                isOverLimit ? 'border-red-500' : 'border-slate-600'
              } ${loading ? 'opacity-50' : ''}`}
              placeholder="Your tweet will appear here..."
            />
            {loading && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-800/80 rounded-xl">
                <div className="flex items-center gap-3 text-white">
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>Generating tweet...</span>
                </div>
              </div>
            )}
          </div>

          {/* Character count */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              <button
                onClick={generateTweet}
                disabled={loading}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Regenerate
              </button>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-sm text-slate-400 hover:text-white transition-colors"
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 text-green-400" />
                    <span className="text-green-400">Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    Copy
                  </>
                )}
              </button>
            </div>
            <span className={`text-sm ${isOverLimit ? 'text-red-400 font-semibold' : 'text-slate-400'}`}>
              {charCount}/{maxChars}
            </span>
          </div>

          {/* Error message */}
          {error && (
            <div className="mt-3 p-3 bg-red-900/30 border border-red-500/50 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
              <p className="text-red-400/70 text-xs mt-1">A fallback tweet has been generated.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-800 border-t border-slate-600">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-400 hover:text-white font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={loading || isOverLimit}
            className="flex items-center gap-2 px-5 py-2 bg-black hover:bg-zinc-900 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Post to X</span>
            <ExternalLink className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
