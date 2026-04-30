'use client';

import Link from 'next/link';
import { TEAMS } from '@/lib/teamConfig';
import type { StanleyCupOddsEntry } from '@/lib/types/playoffs';

interface StanleyCupOddsProps {
  odds: StanleyCupOddsEntry[];
}

const getTeamSlug = (abbrev: string): string => {
  const team = Object.values(TEAMS).find((t) => t.abbreviation === abbrev);
  return team?.slug || '';
};

// Map a 0–100 probability to a tinted background color. Higher % = deeper blue, lower = subtle gray.
// Scale is non-linear — small percentages deserve visibility, high percentages are the visual anchor.
function oddsCellStyle(value: number | undefined | null): React.CSSProperties {
  if (value == null || value <= 0) {
    return { backgroundColor: '#f9fafb', color: '#9ca3af' };
  }
  // Perceptual scale: sqrt gives low values a small lift, high values saturate fast
  const normalized = Math.min(1, Math.sqrt(value / 100));
  // Use blue ramp from very light → strong navy — readable in light theme
  const r = Math.round(239 - 239 * normalized + 0 * normalized); // 239 → 0
  const g = Math.round(246 - 160 * normalized);                  // 246 → 86
  const b = Math.round(255 - 120 * normalized);                  // 255 → 135
  const textColor = normalized > 0.45 ? '#ffffff' : '#111827';
  return { backgroundColor: `rgb(${r},${g},${b})`, color: textColor };
}

function formatPct(value: number | undefined | null): string {
  if (value == null) return '—';
  if (value >= 100) return '100%';
  if (value <= 0) return '0%';
  if (value >= 99.5) return '>99%';
  if (value <= 0.1) return '<1%';
  return `${Math.round(value)}%`;
}

function ConferenceTable({ title, entries }: { title: string; entries: StanleyCupOddsEntry[] }) {
  const sorted = [...entries].sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    return (b.oddsCup ?? b.cupOdds ?? 0) - (a.oddsCup ?? a.cupOdds ?? 0);
  });

  return (
    <div className="flex-1 min-w-0">
      <div className="px-3 py-2 border-b border-gray-200" style={{ background: '#003087' }}>
        <h3 className="text-sm font-bold text-white tracking-wide uppercase">{title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              <th className="text-left font-semibold text-gray-600 py-2 px-2 sticky left-0 bg-gray-50 z-10">Team</th>
              <th className="font-semibold text-gray-600 py-2 px-2 text-center">Win R1</th>
              <th className="font-semibold text-gray-600 py-2 px-2 text-center">Win R2</th>
              <th className="font-semibold text-gray-600 py-2 px-2 text-center">Win Conf</th>
              <th className="font-semibold text-gray-600 py-2 px-2 text-center">Win Cup</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((team) => {
              const slug = getTeamSlug(team.abbrev);
              const TeamCell = (
                <div className="flex items-center gap-2 min-w-[120px]">
                  <img src={team.logo} alt={team.abbrev} className="w-6 h-6 object-contain flex-shrink-0" />
                  <span className="font-semibold text-gray-900 truncate">{team.abbrev}</span>
                  <span className="text-[10px] text-gray-400">({team.seed})</span>
                </div>
              );
              return (
                <tr
                  key={team.abbrev}
                  className={`border-b border-gray-100 ${team.isEliminated ? 'opacity-40' : 'hover:bg-blue-50/30'}`}
                >
                  <td className="py-1.5 px-2 sticky left-0 bg-white z-10">
                    {slug ? (
                      <Link href={`/nhl/${slug}`} className="hover:underline">{TeamCell}</Link>
                    ) : (
                      TeamCell
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums" style={oddsCellStyle(team.oddsR1)}>
                    {formatPct(team.oddsR1)}
                  </td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums" style={oddsCellStyle(team.oddsR2)}>
                    {formatPct(team.oddsR2)}
                  </td>
                  <td className="py-1.5 px-2 text-center font-semibold tabular-nums" style={oddsCellStyle(team.oddsConf)}>
                    {formatPct(team.oddsConf)}
                  </td>
                  <td className="py-1.5 px-2 text-center font-bold tabular-nums" style={oddsCellStyle(team.oddsCup ?? team.cupOdds)}>
                    {formatPct(team.oddsCup ?? team.cupOdds)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function StanleyCupOdds({ odds }: StanleyCupOddsProps) {
  const eastern = odds.filter((t) => t.conferenceName === 'Eastern');
  const western = odds.filter((t) => t.conferenceName === 'Western');

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200" style={{ background: '#003087' }}>
        <h2
          className="text-xl md:text-2xl font-bold text-white"
          style={{ fontFamily: 'Bebas Neue, sans-serif' }}
        >
          Odds
        </h2>
        <p className="text-xs text-white/70 uppercase tracking-wider">
          Cumulative probability of reaching each playoff stage
        </p>
      </div>

      <div className="flex flex-col lg:flex-row lg:divide-x lg:divide-gray-200">
        <ConferenceTable title="Eastern" entries={eastern} />
        <ConferenceTable title="Western" entries={western} />
      </div>
    </div>
  );
}
