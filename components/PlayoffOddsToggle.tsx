'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';

// Shared "Playoff Probability: X%" pill + expandable panel, used by both the
// live ProgressBar and the preseason card so the affordance looks identical in
// both modes. Only the panel contents differ between modes.

interface PlayoffOddsPillProps {
  label: string; // e.g. "Playoff Probability" or "Way-Too-Early Playoff Odds"
  value: string; // e.g. "77%" or "--%"
  expanded: boolean;
  onToggle: () => void;
  color: string;
  size?: 'sm' | 'xs';
}

export function PlayoffOddsPill({
  label,
  value,
  expanded,
  onToggle,
  color,
  size = 'sm',
}: PlayoffOddsPillProps) {
  const textSize = size === 'xs' ? 'text-xs' : 'text-sm';
  const chevronSize = size === 'xs' ? 12 : 14;
  return (
    <button
      onClick={onToggle}
      className={`flex items-center gap-1 ${textSize} font-semibold transition-all focus:outline-none pointer-events-auto`}
      style={{ color }}
      title={expanded ? 'Hide playoff details' : 'Show playoff details'}
    >
      <span className={expanded ? 'underline decoration-2 underline-offset-2' : ''}>
        {label}: {value}
      </span>
      <ChevronDown
        size={chevronSize}
        className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
      />
    </button>
  );
}

interface CollapsibleOddsPanelProps {
  expanded: boolean;
  isGoatMode: boolean;
  children: ReactNode;
}

export function CollapsibleOddsPanel({ expanded, isGoatMode, children }: CollapsibleOddsPanelProps) {
  return (
    <div
      className={`overflow-hidden transition-all duration-300 ease-out ${
        expanded ? 'max-h-[600px] opacity-100 mt-4' : 'max-h-0 opacity-0'
      }`}
    >
      {/* Dashed divider */}
      <div className={`border-t-2 border-dashed mb-4 ${isGoatMode ? 'border-zinc-700' : 'border-gray-300'}`}></div>
      {children}
    </div>
  );
}
