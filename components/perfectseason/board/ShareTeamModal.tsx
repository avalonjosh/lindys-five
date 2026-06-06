'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Link as LinkIcon, X } from 'lucide-react';
import type { SharedTeam } from '@/lib/perfectseason/share';

interface ShareTeamModalProps {
  team: SharedTeam;
  onClose: () => void;
}

type Status = 'saving' | 'ready' | 'error';

/** Brand glyphs (simple-icons paths) for the social row. */
const ICONS: Record<string, React.ReactNode> = {
  x: <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />,
  facebook: <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />,
  bluesky: <path d="M5.769 4.225C8.196 6.018 10.806 9.65 12 11.6c1.194-1.95 3.804-5.582 6.231-7.375C20.232 2.776 23 1.755 23 4.785c0 .643-.353 5.4-.561 6.176-.683 2.658-3.21 3.276-5.49 2.952 3.965.674 4.927 2.96 2.75 5.247-3.974 4.176-5.713-1.048-6.158-2.385-.075-.227-.115-.34-.115-.226 0 .114-.04 0-.115.226-.445 1.337-2.184 6.56-6.158 2.385-2.177-2.287-1.215-4.573 2.75-5.247-2.28.324-4.807-.294-5.49-2.952C1.353 10.185 1 5.428 1 4.785c0-3.03 2.768-2.009 4.769-.56z" />,
  whatsapp: <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />,
  telegram: <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212-.07-.062-.174-.041-.249-.024-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />,
  reddit: <path d="M24 11.779c0-1.459-1.192-2.645-2.657-2.645-.715 0-1.363.286-1.84.746-1.81-1.191-4.259-1.949-6.971-2.046l1.483-4.669 4.016.95c-.012.069-.012.137-.012.205 0 .749.609 1.358 1.359 1.358s1.359-.609 1.359-1.358-.609-1.358-1.359-1.358c-.534 0-.99.309-1.211.756l-4.474-1.06c-.16-.037-.32.063-.359.221l-1.652 5.207c-2.747.076-5.232.83-7.064 2.034-.477-.465-1.129-.755-1.849-.755C1.192 9.134 0 10.32 0 11.779c0 1.069.642 1.984 1.559 2.391-.04.213-.062.43-.062.651 0 3.301 3.847 5.974 8.587 5.974s8.588-2.673 8.588-5.974c0-.221-.022-.435-.062-.647.917-.407 1.559-1.322 1.559-2.391zm-17.182 1.74c0-.749.609-1.358 1.359-1.358.749 0 1.359.609 1.359 1.358 0 .749-.61 1.359-1.359 1.359s-1.359-.61-1.359-1.359zm9.547 4.131c-1.171 1.171-3.41 1.261-4.065 1.261-.656 0-2.896-.09-4.066-1.261-.173-.173-.173-.456 0-.629.173-.173.456-.173.629 0 .738.738 2.318.999 3.437.999 1.118 0 2.698-.261 3.436-.999.173-.173.456-.173.629 0 .173.173.173.456 0 .629zm-.376-2.772c-.749 0-1.359-.61-1.359-1.359 0-.749.61-1.358 1.359-1.358.75 0 1.359.609 1.359 1.358 0 .749-.609 1.359-1.359 1.359z" />,
};

function SocialButton({ label, href, bg, icon }: { label: string; href: string; bg: string; icon: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex flex-col items-center justify-center gap-1.5 rounded-xl py-3 text-white shadow-sm transition-transform hover:scale-[1.03] active:scale-100"
      style={{ background: bg }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
        {icon}
      </svg>
      <span className="text-[11px] font-bold">{label}</span>
    </a>
  );
}

/** "Share your team" sheet: a roster-card preview + pre-filled text + social/copy. */
export default function ShareTeamModal({ team, onClose }: ShareTeamModalProps) {
  const [id, setId] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('saving');
  const [copied, setCopied] = useState(false);
  const posted = useRef(false);

  const slug = team.sport === 'mlb' ? '162-0' : '82-0';
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://lindysfive.com';
  // Falls back to the game page if the save failed, so sharing still works.
  const shareUrl = id ? `${origin}/${slug}/share?id=${id}` : `${origin}/${slug}`;
  const ogUrl = id ? `${origin}/api/og?type=ps-team&id=${id}` : null;
  const text = `I just went ${team.wins}-${team.losses}, think you can go ${slug}?`;
  const hashtags = `${team.sport.toUpperCase()},${slug.replace('-', 'and')}`;

  // Save the roster once on open to mint a short id for the share links.
  useEffect(() => {
    if (posted.current) return;
    posted.current = true;
    (async () => {
      try {
        const res = await fetch('/api/perfectseason/share', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ team }),
        });
        if (!res.ok) throw new Error('save failed');
        const data = (await res.json()) as { id: string };
        setId(data.id);
        setStatus('ready');
      } catch {
        setStatus('error');
      }
    })();
  }, [team]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const enc = encodeURIComponent;
  const socials = [
    { label: 'X / Twitter', bg: '#1DA1F2', icon: ICONS.x, href: `https://twitter.com/intent/tweet?text=${enc(text)}&url=${enc(shareUrl)}&hashtags=${enc(hashtags)}` },
    { label: 'Facebook', bg: '#1877F2', icon: ICONS.facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${enc(shareUrl)}` },
    { label: 'Bluesky', bg: '#0285FF', icon: ICONS.bluesky, href: `https://bsky.app/intent/compose?text=${enc(`${text} ${shareUrl}`)}` },
    { label: 'WhatsApp', bg: '#25D366', icon: ICONS.whatsapp, href: `https://wa.me/?text=${enc(`${text} ${shareUrl}`)}` },
    { label: 'Telegram', bg: '#229ED9', icon: ICONS.telegram, href: `https://t.me/share/url?url=${enc(shareUrl)}&text=${enc(text)}` },
    { label: 'Reddit', bg: '#FF4500', icon: ICONS.reddit, href: `https://www.reddit.com/submit?url=${enc(shareUrl)}&title=${enc(text)}` },
  ];

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard unavailable; ignore */
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label="Share your team">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/50" />
      <div className="animate-sheet-up relative max-h-[92vh] w-full max-w-[400px] overflow-y-auto rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Share your team</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Card preview (1200x630) */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-slate-900" style={{ aspectRatio: '1200 / 630' }}>
          {ogUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={ogUrl} alt="Your team card" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs font-semibold uppercase tracking-widest text-slate-400">
              {status === 'error' ? 'Preview unavailable' : 'Generating card…'}
            </div>
          )}
        </div>

        {/* Pre-filled text */}
        <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2.5">
          <p className="text-sm text-gray-800">{text}</p>
          <p className="text-sm font-bold text-sabres-red">Play {slug}</p>
        </div>

        {/* Share URL */}
        <div className="mt-3 truncate rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-500">
          {shareUrl}
        </div>

        {/* Social buttons */}
        <div className="mt-3 grid grid-cols-3 gap-2">
          {socials.map((s) => (
            <SocialButton key={s.label} label={s.label} href={s.href} bg={s.bg} icon={s.icon} />
          ))}
        </div>

        {/* Copy link */}
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
