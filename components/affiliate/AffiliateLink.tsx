'use client';

import { trackClick } from '@/lib/analytics';

interface AffiliateLinkProps {
  href: string;
  /** Analytics target bucket, e.g. 'gear' | 'tickets'. */
  track?: string;
  /** Analytics label, e.g. the team slug + vendor. */
  trackLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  ariaLabel?: string;
  children: React.ReactNode;
}

/**
 * Standard outbound affiliate anchor: always rel="sponsored noopener noreferrer"
 * (Google guidelines + PageRank hygiene) and opens in a new tab, with optional
 * click tracking for attribution.
 */
export default function AffiliateLink({ href, track, trackLabel, className, style, ariaLabel, children }: AffiliateLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="sponsored noopener noreferrer"
      aria-label={ariaLabel}
      onClick={() => track && trackClick(track, trackLabel)}
      className={className}
      style={style}
    >
      {children}
    </a>
  );
}
