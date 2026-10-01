'use client';

import { useEffect, useState } from 'react';
import { Check, Link as LinkIcon, Share2, X } from 'lucide-react';
import { ICONS, SocialButton } from './board/ShareTeamModal';
import { TIER_LABEL, type StreakCard } from '@/lib/perfectseason/cards';

/** "Share your card" sheet: the share image, a ready-made line, social links, copy. */
export default function ShareCardSheet({ card, onClose }: { card: StreakCard; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);
  const slug = card.sport === 'nhl' ? '82-0' : '162-0';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://www.lindysfive.com';
  const url = `${origin}/cards/${card.id}`;
  const text = `${card.milestone} days straight on ${slug}. Just earned my ${TIER_LABEL[card.tier]} streak card. Can you keep a streak?`;

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enc = encodeURIComponent;
  const socials = [
    { label: 'X / Twitter', bg: '#1DA1F2', icon: ICONS.x, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(url)}` },
    { label: 'Facebook', bg: '#1877F2', icon: ICONS.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}` },
    { label: 'Bluesky', bg: '#0285FF', icon: ICONS.bluesky, href: `https://bsky.app/intent/compose?text=${enc(`${text} ${url}`)}` },
    { label: 'WhatsApp', bg: '#25D366', icon: ICONS.whatsapp, href: `https://wa.me/?text=${enc(`${text} ${url}`)}` },
    { label: 'Telegram', bg: '#229ED9', icon: ICONS.telegram, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text)}` },
    { label: 'Reddit', bg: '#FF4500', icon: ICONS.reddit, href: `https://www.reddit.com/submit?url=${enc(url)}&title=${enc(text)}` },
  ];

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Share your card">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="animate-sheet-up relative max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-left shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Share your card</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-900" style={{ aspectRatio: '1200 / 630' }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/og?type=ps-card&id=${card.id}`} alt={`${card.milestone}-day streak card share image`} className="h-full w-full object-cover" />
        </div>

        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-gray-800">{text}</div>
        <div className="mt-3 truncate rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-500">{url}</div>

        {canNativeShare && (
          <button
            type="button"
            onClick={() => navigator.share({ title: `${card.milestone}-day ${slug} streak card`, text, url }).catch(() => {})}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-sabres-blue py-3 text-sm font-bold uppercase tracking-wide text-white shadow-md transition-colors hover:bg-sabres-light"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
        )}

        <div className="mt-3 grid grid-cols-3 gap-2">
          {socials.map((s) => (
            <SocialButton key={s.label} label={s.label} href={s.href} bg={s.bg} icon={s.icon} />
          ))}
        </div>

        <button
          type="button"
          onClick={onCopy}
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-gray-300 bg-white py-3 text-sm font-bold uppercase tracking-wide text-gray-700 transition-colors hover:border-gray-400"
        >
          {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <LinkIcon className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>
      </div>
    </div>
  );
}
