import { useState } from 'react';
import { Share2, X as XIcon, Link as LinkIcon, Check } from 'lucide-react';

interface ShareButtonMobileProps {
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

export default function ShareButtonMobile({
  teamName,
  teamId,
  pointsPerSet,
  isGoatMode,
  teamColors
}: ShareButtonMobileProps) {
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
    <div className="md:hidden">
      {/* Share Options Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu - positioned above sticky bar */}
          <div
            className="fixed bottom-20 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl p-2 border-2 z-50 w-[280px]"
            style={{ borderColor: buttonColor }}
          >
            <button
              onClick={handleTwitterShare}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#000000' }}
              >
                <XIcon size={16} color="#FFFFFF" />
              </div>
              <span className="font-semibold text-gray-800 text-sm">Share on X</span>
            </button>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-100 rounded-lg transition-colors text-left"
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ backgroundColor: buttonColor }}
              >
                {copied ? <Check size={16} color="#FFFFFF" /> : <LinkIcon size={16} color="#FFFFFF" />}
              </div>
              <span className="font-semibold text-gray-800 text-sm">
                {copied ? 'Link Copied!' : 'Copy Link'}
              </span>
            </button>
          </div>
        </>
      )}

      {/* Sticky Bottom Bar */}
      <div
        className="fixed bottom-0 left-0 right-0 z-30 border-t-2 shadow-lg"
        style={{
          backgroundColor: buttonColor,
          borderTopColor: buttonColor
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-center">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 text-white font-semibold text-sm transition-opacity hover:opacity-80"
            aria-label="Share team page"
          >
            <Share2 size={18} color="#FFFFFF" />
            <span>Share this page</span>
          </button>
        </div>
      </div>
    </div>
  );
}
