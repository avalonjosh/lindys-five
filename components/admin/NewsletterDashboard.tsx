'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Users, Send, Download, RefreshCw, Trash2 } from 'lucide-react';
import AdminNav from './AdminNav';
import { verifySession } from '@/lib/utils/auth';
import type { NewsletterSubscriber, EmailSendRecord } from '@/lib/types';

export default function NewsletterDashboard() {
  const router = useRouter();
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [sends, setSends] = useState<EmailSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTeam, setSendTeam] = useState('');
  const [sendType, setSendType] = useState<'game-recap' | 'set-recap' | 'announcement'>('game-recap');
  const [announcementSlug, setAnnouncementSlug] = useState('road-to-cup-launch');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [testMode, setTestMode] = useState(false);
  const TEST_EMAIL = 'avalonjosh@gmail.com';
  const [filterTeam, setFilterTeam] = useState('all');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    verifySession().then((ok) => {
      if (!ok) router.push('/admin/login');
      else loadData();
    });
  }, [router]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [subRes, sendRes] = await Promise.all([
        fetch('/api/newsletter/subscribers', { credentials: 'include' }),
        fetch('/api/newsletter/subscribers?type=sends', { credentials: 'include' }),
      ]);
      if (!subRes.ok || !sendRes.ok) {
        const status = !subRes.ok ? subRes.status : sendRes.status;
        setError(status === 401 ? 'Session expired — please log in again' : `Failed to load data (${status})`);
        setLoading(false);
        return;
      }
      const subData = await subRes.json();
      setSubscribers(subData.subscribers || []);
      const sendData = await sendRes.json();
      setSends(sendData.sends || []);
    } catch (err) {
      console.error('Failed to load newsletter data:', err);
      setError('Failed to load newsletter data');
    }
    setLoading(false);
  }

  const stats = useMemo(() => {
    const total = subscribers.length;
    const verified = subscribers.filter((s) => s.verified && !s.unsubscribedAt).length;
    const unverified = subscribers.filter((s) => !s.verified && !s.unsubscribedAt).length;
    const unsubscribed = subscribers.filter((s) => s.unsubscribedAt).length;

    const teamCounts: Record<string, number> = {};
    subscribers
      .filter((s) => s.verified && !s.unsubscribedAt)
      .forEach((s) => {
        s.teams.forEach((t) => {
          teamCounts[t] = (teamCounts[t] || 0) + 1;
        });
      });

    return { total, verified, unverified, unsubscribed, teamCounts };
  }, [subscribers]);

  const filteredSubscribers = useMemo(() => {
    if (filterTeam === 'all') return subscribers;
    return subscribers.filter((s) => s.teams.includes(filterTeam));
  }, [subscribers, filterTeam]);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    subscribers.forEach((s) => s.teams.forEach((t) => teams.add(t)));
    return Array.from(teams).sort();
  }, [subscribers]);

  async function handleManualSend() {
    // Announcements don't need a team; recaps do.
    if (sendType !== 'announcement' && !sendTeam) return;
    setSending(true);
    setSendMessage('');
    try {
      const payload: Record<string, unknown> = { type: sendType };
      if (sendType === 'announcement') {
        payload.announcementSlug = announcementSlug;
      } else {
        payload.team = sendTeam;
      }
      if (testMode) payload.testEmail = TEST_EMAIL;
      const res = await fetch('/api/newsletter/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      setSendMessage(res.ok ? data.message : data.error);
      if (res.ok) {
        setSendTeam('');
        loadData();
      }
    } catch {
      setSendMessage('Network error');
    }
    setSending(false);
  }

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Delete subscriber ${email}? This cannot be undone.`)) return;
    try {
      const res = await fetch('/api/newsletter/subscribers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ id }),
      });
      if (res.ok) {
        setSubscribers((prev) => prev.filter((s) => s.id !== id));
      }
    } catch {
      // ignore
    }
  }

  function exportCSV() {
    const active = subscribers.filter((s) => s.verified && !s.unsubscribedAt);
    const csv = [
      'email,teams,subscribed_at,source',
      ...active.map(
        (s) => `${s.email},"${s.teams.join(', ')}",${s.createdAt},${s.source || ''}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `newsletter-subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav activeTab="newsletter" />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <AdminNav activeTab="newsletter" />
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <p className="text-red-500 text-lg mb-3">{error}</p>
          <button
            onClick={loadData}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav activeTab="newsletter" />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={stats.total} color="#003087" />
          <StatCard icon={<Mail className="w-5 h-5" />} label="Verified" value={stats.verified} color="#16a34a" />
          <StatCard icon={<Mail className="w-5 h-5" />} label="Unverified" value={stats.unverified} color="#f59e0b" />
          <StatCard icon={<Send className="w-5 h-5" />} label="Emails Sent" value={sends.reduce((sum, s) => sum + s.recipientCount, 0)} color="#7c3aed" />
        </div>

        {/* Team Breakdown */}
        {Object.keys(stats.teamCounts).length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Subscribers by Team</h2>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.teamCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([team, count]) => (
                  <span key={team} className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 text-sm font-medium">
                    {team}: {count}
                  </span>
                ))}
            </div>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Manual Send */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Send className="w-5 h-5" /> Manual Send
            </h2>
            <p className="text-gray-500 text-sm mb-3">
              {sendType === 'announcement'
                ? 'Send a product update to every verified subscriber.'
                : "Send an email recap for a team's most recent game or completed set."}
            </p>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => { setSendType('game-recap'); setSendMessage(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sendType === 'game-recap' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Game Recap
              </button>
              <button
                onClick={() => { setSendType('set-recap'); setSendMessage(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sendType === 'set-recap' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Set Recap
              </button>
              <button
                onClick={() => { setSendType('announcement'); setSendMessage(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sendType === 'announcement' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Announcement
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {sendType === 'announcement' ? (
                <select
                  value={announcementSlug}
                  onChange={(e) => { setAnnouncementSlug(e.target.value); setSendMessage(''); }}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="road-to-cup-launch">Road to the Cup + Sabres History launch</option>
                </select>
              ) : (
                <select
                  value={sendTeam}
                  onChange={(e) => { setSendTeam(e.target.value); setSendMessage(''); }}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:border-blue-400 bg-white"
                >
                  <option value="">Select a team...</option>
                  {allTeams.map((t) => (
                    <option key={t} value={t}>{t} ({stats.teamCounts[t] || 0} subscribers)</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleManualSend}
                disabled={sending || (sendType !== 'announcement' && !sendTeam)}
                className={`px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 ${
                  testMode
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {sending ? 'Sending...' : testMode ? 'Send Test' : 'Send'}
              </button>
            </div>
            <label className="flex items-center gap-2 mt-3 text-sm text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => { setTestMode(e.target.checked); setSendMessage(''); }}
                className="w-4 h-4 rounded border-gray-300 text-amber-600 focus:ring-amber-500"
              />
              <span>Test mode — send to <span className="font-mono text-gray-900">{TEST_EMAIL}</span> only</span>
            </label>
            {sendMessage && (
              <p className={`text-sm mt-2 ${sendMessage.includes('error') || sendMessage.includes('Failed') ? 'text-red-500' : 'text-green-600'}`}>
                {sendMessage}
              </p>
            )}
          </div>

          {/* Aggregate Stats */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Email Performance</h2>
            {sends.length === 0 ? (
              <p className="text-gray-400 text-sm">No emails sent yet</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {(() => {
                  const totals = sends.reduce(
                    (acc, s) => ({
                      sent: acc.sent + s.recipientCount,
                      delivered: acc.delivered + (s.delivered || 0),
                      opened: acc.opened + (s.opened || 0),
                      clicked: acc.clicked + (s.clicked || 0),
                      bounced: acc.bounced + (s.bounced || 0),
                    }),
                    { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
                  );
                  const pct = (n: number, d: number) => d > 0 ? `${((n / d) * 100).toFixed(1)}%` : '—';
                  return (
                    <>
                      <div className="text-center p-3 rounded-lg bg-green-50">
                        <div className="text-2xl font-bold text-green-700">{pct(totals.delivered, totals.sent)}</div>
                        <div className="text-xs text-green-600">Delivery Rate</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-blue-50">
                        <div className="text-2xl font-bold text-blue-700">{pct(totals.opened, totals.delivered)}</div>
                        <div className="text-xs text-blue-600">Open Rate</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-purple-50">
                        <div className="text-2xl font-bold text-purple-700">{pct(totals.clicked, totals.delivered)}</div>
                        <div className="text-xs text-purple-600">Click Rate</div>
                      </div>
                      <div className="text-center p-3 rounded-lg bg-red-50">
                        <div className="text-2xl font-bold text-red-700">{pct(totals.bounced, totals.sent)}</div>
                        <div className="text-xs text-red-600">Bounce Rate</div>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>

        {/* Recent Sends Table */}
        {sends.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Recent Sends</h2>
            {/* Mobile: Card layout */}
            <div className="sm:hidden space-y-3">
              {sends.slice(0, 20).map((send) => {
                const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
                const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
                return (
                  <div key={send.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="text-sm font-medium text-gray-900 truncate mb-1">{send.subject}</div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                      <span>{send.team}</span>
                      <span>&middot;</span>
                      <span>{new Date(send.sentAt).toLocaleDateString()}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-2 text-center text-xs">
                      <div>
                        <div className="font-semibold text-gray-700">{send.recipientCount}</div>
                        <div className="text-gray-400">Sent</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-700">{openRate}</div>
                        <div className="text-gray-400">Opens</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-700">{clickRate}</div>
                        <div className="text-gray-400">Clicks</div>
                      </div>
                      <div>
                        <div className={`font-semibold ${(send.bounced || 0) > 0 ? 'text-red-600' : 'text-gray-400'}`}>{send.bounced || 0}</div>
                        <div className="text-gray-400">Bounced</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-gray-200">
                    <th className="pb-2 font-medium text-gray-500">Subject</th>
                    <th className="pb-2 font-medium text-gray-500">Team</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Sent</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Delivered</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Opened</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Clicked</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Bounced</th>
                    <th className="pb-2 font-medium text-gray-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {sends.slice(0, 20).map((send) => {
                    const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) : '—';
                    const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) : '—';
                    return (
                      <tr key={send.id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-900 max-w-[200px] truncate">{send.subject}</td>
                        <td className="py-2 text-gray-600">{send.team}</td>
                        <td className="py-2 text-center text-gray-700">{send.recipientCount}</td>
                        <td className="py-2 text-center text-gray-700">{send.delivered || 0}</td>
                        <td className="py-2 text-center">
                          <span className="text-gray-700">{send.opened || 0}</span>
                          {openRate !== '—' && <span className="text-gray-400 text-xs ml-1">({openRate}%)</span>}
                        </td>
                        <td className="py-2 text-center">
                          <span className="text-gray-700">{send.clicked || 0}</span>
                          {clickRate !== '—' && <span className="text-gray-400 text-xs ml-1">({clickRate}%)</span>}
                        </td>
                        <td className="py-2 text-center">
                          {(send.bounced || 0) > 0 ? (
                            <span className="text-red-600">{send.bounced}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-500 text-xs whitespace-nowrap">{new Date(send.sentAt).toLocaleDateString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Subscribers Table */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mt-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-bold text-gray-900">Subscribers</h2>
            <div className="flex items-center gap-2">
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
              >
                <option value="all">All teams</option>
                {allTeams.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
              </button>
              <button
                onClick={loadData}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>

          {filteredSubscribers.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-8">No subscribers yet</p>
          ) : (
            <>
              {/* Mobile: Card layout */}
              <div className="sm:hidden space-y-3">
                {filteredSubscribers.map((sub) => (
                  <div key={sub.id} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-sm font-medium text-gray-900 break-all">{sub.email}</div>
                      <button
                        onClick={() => handleDelete(sub.id, sub.email)}
                        className="text-gray-400 hover:text-red-500 transition-colors ml-2 shrink-0"
                        title="Delete subscriber"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {sub.unsubscribedAt ? (
                        <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600">Unsubscribed</span>
                      ) : sub.verified ? (
                        <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600">Verified</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600">Pending</span>
                      )}
                      <span className="text-gray-400">{sub.source || '-'}</span>
                      <span className="text-gray-400">{new Date(sub.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{sub.teams.join(', ')}</div>
                  </div>
                ))}
              </div>

              {/* Desktop: Table layout */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="pb-2 font-medium text-gray-500">Email</th>
                      <th className="pb-2 font-medium text-gray-500">Teams</th>
                      <th className="pb-2 font-medium text-gray-500">Status</th>
                      <th className="pb-2 font-medium text-gray-500">Source</th>
                      <th className="pb-2 font-medium text-gray-500">Subscribed</th>
                      <th className="pb-2 font-medium text-gray-500"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSubscribers.map((sub) => (
                      <tr key={sub.id} className="border-b border-gray-50">
                        <td className="py-2 text-gray-900">{sub.email}</td>
                        <td className="py-2 text-gray-600">{sub.teams.join(', ')}</td>
                        <td className="py-2">
                          {sub.unsubscribedAt ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-50 text-red-600 text-xs">Unsubscribed</span>
                          ) : sub.verified ? (
                            <span className="px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-xs">Verified</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-600 text-xs">Pending</span>
                          )}
                        </td>
                        <td className="py-2 text-gray-500">{sub.source || '-'}</td>
                        <td className="py-2 text-gray-500">{new Date(sub.createdAt).toLocaleDateString()}</td>
                        <td className="py-2">
                          <button
                            onClick={() => handleDelete(sub.id, sub.email)}
                            className="text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete subscriber"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span style={{ color }}>{icon}</span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="text-2xl font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
