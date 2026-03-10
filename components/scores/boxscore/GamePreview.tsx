'use client';

import { TEAMS } from '@/lib/teamConfig';
import { generateGameTicketLink } from '@/lib/utils/affiliateLinks';
import { trackClick } from '@/lib/analytics';

interface GamePreviewProps {
  homeAbbrev: string;
  awayAbbrev: string;
  gameDate: string;
}

export default function GamePreview({
  homeAbbrev,
  awayAbbrev,
  gameDate,
}: GamePreviewProps) {
  const venueTeam = Object.values(TEAMS).find(t => t.abbreviation === homeAbbrev);

  const ticketLink = venueTeam
    ? generateGameTicketLink(
        venueTeam.slug,
        venueTeam.city,
        venueTeam.stubhubId,
        homeAbbrev,
        awayAbbrev,
        gameDate
      )
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="text-center space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Game Preview</h3>
        <p className="text-sm text-gray-500">
          This game hasn&apos;t started yet. Check back for live updates and full box score stats.
        </p>
        {ticketLink && (
          <a
            href={ticketLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackClick('ticket-boxscore', `${homeAbbrev}-vs-${awayAbbrev}`)}
            className="inline-block px-5 py-2.5 text-sm font-bold rounded-lg transition-all shadow-md hover:shadow-lg bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white"
          >
            Get Tickets
          </a>
        )}
      </div>
    </div>
  );
}
