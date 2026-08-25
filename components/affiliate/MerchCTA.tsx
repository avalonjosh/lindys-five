'use client';

import { ShoppingBag } from 'lucide-react';
import { generateMerchLink, FANATICS_ENABLED } from '@/lib/utils/affiliateLinks';
import { trackClick } from '@/lib/analytics';

function isLightColor(hex: string): boolean {
  const c = hex.replace('#', '');
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

interface MerchCTAProps {
  teamCity: string;
  teamName: string;
  sport: 'nhl' | 'mlb';
  variant: 'compact' | 'card';
  primaryColor?: string;
  /** Team route slug; used to resolve the Fanatics storefront for this team. */
  teamSlug?: string;
  /** Impact subId2 placement tag, e.g. `teampage`, `blog`, `chunk`. */
  placement?: string;
}

export default function MerchCTA({ teamCity, teamName, sport, variant, primaryColor, teamSlug, placement = 'teampage' }: MerchCTAProps) {
  // Warm, on-site traffic converts best when sent straight to the merchant's
  // team storefront, so this links directly to Fanatics (sub-ID stamped) rather
  // than the on-site /gear hub. Amazon is the fallback until Fanatics is configured.
  const slug = teamSlug || teamName.toLowerCase().replace(/\s+/g, '');
  const href = generateMerchLink(sport, slug, teamCity, teamName, placement);
  const vendor = FANATICS_ENABLED ? 'fanatics' : 'amazon';
  const handleClick = () => trackClick('merch', `${sport}-${slug}-${vendor}-${placement}`);

  const Anchor = ({ className, style, children }: { className: string; style: React.CSSProperties; children: React.ReactNode }) => (
    <a href={href} target="_blank" rel="sponsored noopener noreferrer" onClick={handleClick} className={className} style={style}>{children}</a>
  );

  if (variant === 'compact') {
    const isLightBg = primaryColor ? isLightColor(primaryColor) : false;
    const textColor = isLightBg ? '#1a1a2e' : '#ffffff';
    return (
      <Anchor
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full transition-all hover:scale-105 shadow-sm"
        style={{ backgroundColor: primaryColor || '#1a1a2e', color: textColor }}
      >
        <ShoppingBag size={12} />
        Shop Gear
      </Anchor>
    );
  }

  // card variant
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-4">
      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: primaryColor || '#1a1a2e' }}>
        <ShoppingBag size={18} color="#ffffff" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">Shop {teamCity} {teamName} Gear</p>
        <p className="text-xs text-gray-500">Jerseys, hats, and apparel</p>
      </div>
      <Anchor
        className="flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg transition-all hover:shadow-md"
        style={{ backgroundColor: primaryColor || '#1a1a2e', color: '#ffffff' }}
      >
        Shop Now
      </Anchor>
    </div>
  );
}
