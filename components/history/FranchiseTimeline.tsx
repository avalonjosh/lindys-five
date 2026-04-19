'use client';

import type { FranchiseEvent, FranchiseEventCategory } from '@/lib/data/teamHistory';
import YouTubeEmbed from './YouTubeEmbed';

interface FranchiseTimelineProps {
  events: FranchiseEvent[];
}

const CATEGORY_LABELS: Record<FranchiseEventCategory, string> = {
  founding: 'Founding',
  arena: 'Arena',
  ownership: 'Ownership',
  era: 'Era',
  player: 'Player',
  championship: 'Championship',
  other: 'Milestone',
};

function formatEventDate(raw: string): string {
  if (/^\d{4}$/.test(raw)) return raw;
  const parts = raw.split('-').map(Number);
  if (parts.length === 3 && parts.every((n) => !Number.isNaN(n))) {
    const [y, m, d] = parts;
    const dt = new Date(y, m - 1, d);
    return dt.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return raw;
}

export default function FranchiseTimeline({ events }: FranchiseTimelineProps) {
  if (events.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-12 text-center">
        <p className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
          Franchise history coming soon.
        </p>
        <p className="text-sm text-gray-600 max-w-md mx-auto">
          Founding, arenas, eras, legendary players, and the moments that
          shaped this team. Stay tuned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event, idx) => (
        <article
          key={`${event.date}-${idx}`}
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5"
        >
          <div className="flex items-baseline justify-between gap-3 mb-1">
            <p className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
              {CATEGORY_LABELS[event.category]}
            </p>
            <p className="text-[11px] sm:text-xs text-gray-400">
              {formatEventDate(event.date)}
            </p>
          </div>
          <h3 className="text-base sm:text-lg font-bold text-gray-900">
            {event.title}
          </h3>
          {event.body && (
            <p className="text-sm sm:text-base text-gray-700 mt-2">
              {event.body}
            </p>
          )}
          {event.youtubeId && (
            <div className="mt-3">
              <YouTubeEmbed videoId={event.youtubeId} title={event.title} />
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
