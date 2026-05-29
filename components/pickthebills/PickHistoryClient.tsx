'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, ArrowLeft } from 'lucide-react';

const BILLS_BLUE = '#00338D';

interface HistoryRow {
  game_id: string;
  week_label: string;
  opponent: string;
  predicted: 'W' | 'L';
  confidence: number | null;
  created_at: string;
  window_label: string;
  window_type: string;
  before_kickoff: boolean;
}

const ET = { timeZone: 'America/New_York', month: 'short', day: 'numeric' } as const;
function fmt(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', ET);
}

export default function PickHistoryClient({ userId }: { userId: string }) {
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [rows, setRows] = useState<HistoryRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/pickthebills/history?userId=${encodeURIComponent(userId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).error || 'Not found');
        return res.json();
      })
      .then((json) => {
        setDisplayName(json.displayName);
        setRows(json.history);
      })
      .catch((e) => setError(e.message));
  }, [userId]);

  // Group history rows by game, preserving the kickoff/created_at order.
  const byGame: { gameId: string; weekLabel: string; opponent: string; picks: HistoryRow[] }[] = [];
  for (const r of rows ?? []) {
    let g = byGame.find((x) => x.gameId === r.game_id);
    if (!g) {
      g = { gameId: r.game_id, weekLabel: r.week_label, opponent: r.opponent, picks: [] };
      byGame.push(g);
    }
    g.picks.push(r);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 py-6 text-white" style={{ background: BILLS_BLUE }}>
        <div className="max-w-2xl mx-auto">
          <Link href="/pickthebills" className="inline-flex items-center gap-1 text-white/80 hover:text-white text-sm mb-2">
            <ArrowLeft className="w-4 h-4" /> Leaderboard
          </Link>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>
            {displayName || 'Fan'}&rsquo;s picks
          </h1>
          <p className="text-white/70 text-sm">How their call on each game changed over the season.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {error ? (
          <div className="text-center py-12 text-gray-500">{error}</div>
        ) : !rows ? (
          <div className="flex justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : byGame.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No picks yet.</div>
        ) : (
          <div className="space-y-3">
            {byGame.map((g) => {
              // Effective pick = last row made before kickoff.
              const effectiveIdx = (() => {
                let idx = -1;
                g.picks.forEach((p, i) => {
                  if (p.before_kickoff) idx = i;
                });
                return idx;
              })();
              return (
                <div key={g.gameId} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-400">{g.weekLabel}</div>
                  <div className="font-semibold text-gray-900 mb-3">vs {g.opponent}</div>
                  <ol className="space-y-1.5">
                    {g.picks.map((p, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm">
                        <span
                          className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold text-white ${
                            !p.before_kickoff ? 'opacity-40' : ''
                          }`}
                          style={{ background: p.predicted === 'W' ? BILLS_BLUE : '#C60C30' }}
                        >
                          {p.predicted}
                        </span>
                        <span className="text-gray-600">{p.window_label}</span>
                        <span className="text-gray-300">·</span>
                        <span className="text-gray-400">{fmt(p.created_at)}</span>
                        {i === effectiveIdx && (
                          <span className="ml-auto text-xs font-semibold text-emerald-600">counts</span>
                        )}
                        {!p.before_kickoff && <span className="ml-auto text-xs text-gray-400">after kickoff</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
