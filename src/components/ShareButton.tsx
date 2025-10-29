import { useState } from 'react';
import { Share2, X as XIcon, Link as LinkIcon, Check } from 'lucide-react';

interface ShareButtonProps {
  teamName: string;
  teamId: string;
  pointsPerSet: number;
  isGoatMode: boolean;
  teamColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
}

export default function ShareButton({
  teamName,
  teamId,
  pointsPerSet,
  isGoatMode,
  teamColors
}: ShareButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // Use current hostname for development, production domain for live site
  const hostname = window.location.hostname;
  const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
  const baseUrl = isLocalhost ? `http://${hostname}:${window.location.port}` : 'https://lindysfive.com';
  const teamUrl = `${baseUrl}/team/${teamId}`;

  const tweetText = `${teamName} are averaging ${pointsPerSet.toFixed(1)} points per set! 🏒
Track their road to the playoffs at ${teamUrl}
#LindysFive`;

  const handleTwitterShare = () => {
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
    setIsOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(teamUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        setIsOpen(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const buttonColor = isGoatMode ? teamColors.accent : teamColors.primary;

  return (
    <div className="fixed bottom-6 right-6 z-50 hidden md:block">
      {/* Share Options Menu */}
      {isOpen && (
        <div
          className="absolute bottom-16 right-0 bg-white rounded-lg shadow-2xl p-2 mb-2 border-2"
          style={{ borderColor: buttonColor }}
        >
          <button
            onClick={handleTwitterShare}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: '#000000' }}
            >
              <XIcon size={20} color="#FFFFFF" />
            </div>
            <span className="font-semibold text-gray-800">Share on X</span>
          </button>

          <button
            onClick={handleCopyLink}
            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ backgroundColor: buttonColor }}
            >
              {copied ? <Check size={20} color="#FFFFFF" /> : <LinkIcon size={20} color="#FFFFFF" />}
            </div>
            <span className="font-semibold text-gray-800">
              {copied ? 'Link Copied!' : 'Copy Link'}
            </span>
          </button>
        </div>
      )}

      {/* Main Share Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        style={{ backgroundColor: buttonColor }}
        aria-label="Share team page"
      >
        <Share2 size={24} color="#FFFFFF" />
      </button>
    </div>
  );
}
