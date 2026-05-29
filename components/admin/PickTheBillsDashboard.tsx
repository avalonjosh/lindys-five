'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Lock, Plus } from 'lucide-react';
import AdminNav from './AdminNav';

interface GameRow {
  id: string;
  espnId: string;
  season: number;
  weekLabel: string;
  opponent: string;
  home: boolean;
  kickoffAt: string;
  status: string;
  result: string | null;
}

interface WindowRow {
  id: string;
  season: number;
  label: string;
  type: string;
  opensAt: string;
  locksAt: string;
  status: string;
}

interface DashboardData {
  season: number | null;
  games: GameRow[];
  windows: WindowRow[];
  nextKickoff: string | null;
}

const ET = { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' } as const;
function fmt(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', ET) + ' ET';
}

export default function PickTheBillsDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [label, setLabel] = useState('');
  const [type, setType] = useState<'baseline' | 'scheduled' | 'event'>('baseline');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/pickthebills', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function refreshSchedule() {
    setBusy('refresh');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/pickthebills/schedule/refresh', { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        setNotice(`Schedule refreshed: ${json.upserted} games (${json.skipped} skipped).`);
        await load();
      } else {
        setNotice(json.error || 'Refresh failed');
      }
    } finally {
      setBusy(null);
    }
  }

  async function createWindow(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    setBusy('create');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/pickthebills/windows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: label.trim(), type }),
      });
      const json = await res.json();
      if (res.ok) {
        setNotice(`Window "${json.window.label}" opened, locks ${fmt(json.window.locksAt)}.`);
        setLabel('');
        await load();
      } else {
        setNotice(json.error || 'Create failed');
      }
    } finally {
      setBusy(null);
    }
  }

  async function lock(id: string) {
    setBusy(`lock-${id}`);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/pickthebills/windows/${id}/lock`, { method: 'POST', credentials: 'include' });
      const json = await res.json();
      if (res.ok) {
        await load();
      } else {
        setNotice(json.error || 'Lock failed');
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <AdminNav activeTab="pickthebills" />
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-6 space-y-6">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-slate-600 border-t-[#FCB514]" />
          </div>
        ) : error ? (
          <div className="text-center py-16 text-red-400">{error}</div>
        ) : (
          <>
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-xl font-bold text-white">
                Season {data?.season ?? '—'}
                <span className="text-slate-400 text-sm font-normal ml-2">
                  next kickoff {fmt(data?.nextKickoff ?? null)}
                </span>
              </h2>
              <button
                onClick={refreshSchedule}
                disabled={busy === 'refresh'}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
                Refresh schedule
              </button>
            </div>

            {notice && (
              <div className="bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm text-slate-200">{notice}</div>
            )}

            {/* Create window */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-white font-semibold mb-3">Open a new window</h3>
              <p className="text-slate-400 text-sm mb-4">
                Opening a window locks any currently open one. It auto-locks at the next kickoff.
              </p>
              <form onSubmit={createWindow} className="flex flex-col sm:flex-row gap-3">
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder='Label (e.g. "Season Baseline", "Trade: Acquired X")'
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-[#FCB514]"
                />
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as typeof type)}
                  className="px-4 py-2.5 rounded-lg text-sm bg-slate-900 border border-slate-600 text-white focus:outline-none focus:border-[#FCB514]"
                >
                  <option value="baseline">Baseline</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="event">Event</option>
                </select>
                <button
                  type="submit"
                  disabled={busy === 'create' || !label.trim()}
                  className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  Open window
                </button>
              </form>
            </div>

            {/* Windows */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-white font-semibold mb-3">Windows ({data?.windows.length ?? 0})</h3>
              {data && data.windows.length > 0 ? (
                <div className="space-y-2">
                  {data.windows.map((w) => (
                    <div key={w.id} className="flex items-center justify-between gap-3 bg-slate-900 rounded-lg px-4 py-3">
                      <div className="min-w-0">
                        <div className="text-white font-medium truncate">
                          {w.label}
                          <span className="ml-2 text-xs uppercase tracking-wide text-slate-500">{w.type}</span>
                        </div>
                        <div className="text-xs text-slate-400">
                          opened {fmt(w.opensAt)} · locks {fmt(w.locksAt)}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded ${
                            w.status === 'open' ? 'bg-emerald-900 text-emerald-300' : 'bg-slate-700 text-slate-400'
                          }`}
                        >
                          {w.status}
                        </span>
                        {w.status === 'open' && (
                          <button
                            onClick={() => lock(w.id)}
                            disabled={busy === `lock-${w.id}`}
                            className="flex items-center gap-1 text-xs text-slate-300 hover:text-white transition-colors disabled:opacity-50"
                          >
                            <Lock className="w-3.5 h-3.5" />
                            Lock
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">No windows yet. Open the season baseline to start.</p>
              )}
            </div>

            {/* Games */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h3 className="text-white font-semibold mb-3">Games ({data?.games.length ?? 0})</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-slate-400 text-xs uppercase tracking-wide">
                    <tr>
                      <th className="text-left py-2 pr-3">Week</th>
                      <th className="text-left py-2 pr-3">Matchup</th>
                      <th className="text-left py-2 pr-3">Kickoff</th>
                      <th className="text-left py-2 pr-3">Status</th>
                      <th className="text-left py-2">Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.games.map((g) => (
                      <tr key={g.id} className="border-t border-slate-700/60 text-slate-200">
                        <td className="py-2 pr-3 whitespace-nowrap">{g.weekLabel}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">{g.home ? 'vs' : '@'} {g.opponent}</td>
                        <td className="py-2 pr-3 whitespace-nowrap text-slate-400">{fmt(g.kickoffAt)}</td>
                        <td className="py-2 pr-3">{g.status}</td>
                        <td className="py-2 font-semibold">{g.result ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
