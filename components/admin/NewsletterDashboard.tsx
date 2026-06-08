'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Users, Send, Download, RefreshCw, Trash2, Power, AlertTriangle, TrendingUp, MousePointerClick } from 'lucide-react';
import AdminNav from './AdminNav';
import { verifySession } from '@/lib/utils/auth';
import type { NewsletterSubscriber, EmailSendRecord } from '@/lib/types';

// Gated email programs (KV flags via /api/blog/settings) with their cron trigger
// type and human cadence. NHL recaps aren't here — they're sent per-team via
// Manual Send below.
const PROGRAMS = [
  { key: 'weekly-digest-enabled', trigger: 'weekly-digest', label: 'Weekly Digest', schedule: 'Thu 10am ET' },
  { key: 'mlb-recap-enabled', trigger: 'email-mlb-game-recap', label: 'MLB Game Recap', schedule: 'Daily 9am ET' },
  { key: 'mlb-set-recap-enabled', trigger: 'email-mlb-set-recap', label: 'MLB Set Recap', schedule: 'Daily 9:30am ET' },
] as const;

const CAMPAIGN_LABEL: Record<string, string> = {
  'game-recap': 'NHL Game Recap',
  'set-recap': 'NHL Set Recap',
  'mlb-game-recap': 'MLB Game Recap',
  'mlb-set-recap': 'MLB Set Recap',
  'weekly-digest': 'Weekly Digest',
  'announcement': 'Announcement',
  'other': 'Other',
};

/** Program a send belongs to: explicit `campaign`, else inferred from `team` for
 *  pre-campaign records. */
function campaignOf(s: EmailSendRecord): string {
  if (s.campaign) return s.campaign;
  const t = s.team || '';
  if (t === 'weekly-digest') return 'weekly-digest';
  if (t === 'announcement') return 'announcement';
  if (t.startsWith('mlb-set-recap')) return 'mlb-set-recap';
  if (t.startsWith('mlb-recap')) return 'mlb-game-recap';
  return 'game-recap';
}

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
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending' | 'unsubscribed'>('all');
  const [filterSource, setFilterSource] = useState('all');
  const [error, setError] = useState<string | null>(null);
  // Email program toggles + per-program busy state for test/run buttons.
  const [programs, setPrograms] = useState<Record<string, boolean>>({});
  const [programBusy, setProgramBusy] = useState<string | null>(null);
  const [programMessage, setProgramMessage] = useState('');

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
      // Program toggles (GET is public; POST is admin-gated).
      try {
        const setRes = await fetch('/api/blog/settings', { credentials: 'include' });
        if (setRes.ok) setPrograms((await setRes.json()).settings || {});
      } catch {
        /* non-fatal */
      }
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
    return subscribers.filter((s) => {
      if (filterTeam !== 'all' && !s.teams.includes(filterTeam)) return false;
      if (filterSource !== 'all' && (s.source || '—') !== filterSource) return false;
      if (filterStatus === 'verified' && !(s.verified && !s.unsubscribedAt)) return false;
      if (filterStatus === 'pending' && !(!s.verified && !s.unsubscribedAt)) return false;
      if (filterStatus === 'unsubscribed' && !s.unsubscribedAt) return false;
      return true;
    });
  }, [subscribers, filterTeam, filterSource, filterStatus]);

  const allTeams = useMemo(() => {
    const teams = new Set<string>();
    subscribers.forEach((s) => s.teams.forEach((t) => teams.add(t)));
    return Array.from(teams).sort();
  }, [subscribers]);

  // Where active subscribers came from (the capture points we added).
  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    subscribers
      .filter((s) => !s.unsubscribedAt)
      .forEach((s) => {
        const src = s.source || '—';
        counts[src] = (counts[src] || 0) + 1;
      });
    return counts;
  }, [subscribers]);

  const allSources = useMemo(() => Object.keys(sourceCounts).sort(), [sourceCounts]);

  // Daily new-signup counts for the last 30 days (oldest → newest) for the sparkline.
  const signups30 = useMemo(() => {
    const days = 30;
    const buckets = new Array(days).fill(0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    subscribers.forEach((s) => {
      const d = new Date(s.createdAt);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
      if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
    });
    return buckets;
  }, [subscribers]);
  const signupsTotal30 = useMemo(() => signups30.reduce((a, b) => a + b, 0), [signups30]);

  // Sender-reputation health: bounce / complaint over sent, unsubscribe over total.
  const health = useMemo(() => {
    const sent = sends.reduce((a, s) => a + s.recipientCount, 0);
    const bounced = sends.reduce((a, s) => a + (s.bounced || 0), 0);
    const complained = sends.reduce((a, s) => a + (s.complained || 0), 0);
    const affiliateClicks = sends.reduce((a, s) => a + (s.affiliateClicks || 0), 0);
    const pct = (n: number, d: number) => (d > 0 ? (n / d) * 100 : 0);
    return {
      bounceRate: pct(bounced, sent),
      complaintRate: pct(complained, sent),
      unsubRate: pct(stats.unsubscribed, stats.total),
      affiliateClicks,
    };
  }, [sends, stats]);

  // Per-program performance (delivery/open/click) grouped by campaign.
  const programPerf = useMemo(() => {
    const acc: Record<string, { sent: number; delivered: number; opened: number; clicked: number; affiliateClicks: number }> = {};
    for (const s of sends) {
      const c = campaignOf(s);
      const a = (acc[c] ||= { sent: 0, delivered: 0, opened: 0, clicked: 0, affiliateClicks: 0 });
      a.sent += s.recipientCount;
      a.delivered += s.delivered || 0;
      a.opened += s.opened || 0;
      a.clicked += s.clicked || 0;
      a.affiliateClicks += s.affiliateClicks || 0;
    }
    return Object.entries(acc).sort((x, y) => y[1].sent - x[1].sent);
  }, [sends]);

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

  async function toggleProgram(key: string, value: boolean) {
    setPrograms((p) => ({ ...p, [key]: value })); // optimistic
    setProgramMessage('');
    try {
      const res = await fetch('/api/blog/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ key, value }),
      });
      if (!res.ok) {
        setPrograms((p) => ({ ...p, [key]: !value })); // revert
        setProgramMessage(`Failed to update ${key}`);
      }
    } catch {
      setPrograms((p) => ({ ...p, [key]: !value }));
      setProgramMessage('Network error');
    }
  }

  // Test (to TEST_EMAIL) or real "Run now" for a program, via the cron trigger.
  async function runProgram(trigger: string, label: string, mode: 'test' | 'run') {
    if (mode === 'run' && !confirm(`Run "${label}" now? This sends real emails to the list.`)) return;
    setProgramBusy(`${trigger}:${mode}`);
    setProgramMessage('');
    try {
      const res = await fetch('/api/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'test' ? { type: trigger, test: TEST_EMAIL } : { type: trigger }),
      });
      const data = await res.json();
      setProgramMessage(
        res.ok
          ? mode === 'test'
            ? `${label}: test sent to ${TEST_EMAIL}`
            : `${label}: ${data.skipped ? `skipped — ${data.skipped}` : 'ran (see Recent Sends)'}`
          : data.error || `Failed to run ${label}`,
      );
      if (res.ok && mode === 'run') loadData();
    } catch {
      setProgramMessage('Network error');
    }
    setProgramBusy(null);
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

        {/* Email Programs */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 mb-8">
          <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
            <Power className="w-5 h-5" /> Email Programs
          </h2>
          <p className="text-gray-500 text-sm mb-4">Enable, test, or run the automated sends. Off = the cron skips real delivery.</p>
          <div className="divide-y divide-gray-100">
            {PROGRAMS.map((p) => {
              const on = !!programs[p.key];
              return (
                <div key={p.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium text-gray-900">{p.label}</div>
                    <div className="text-xs text-gray-400">{p.schedule}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleProgram(p.key, !on)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${on ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={on ? 'Enabled — click to disable' : 'Disabled — click to enable'}
                    >
                      <span className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${on ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </button>
                    <button
                      onClick={() => runProgram(p.trigger, p.label, 'test')}
                      disabled={programBusy !== null}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {programBusy === `${p.trigger}:test` ? '…' : 'Test'}
                    </button>
                    <button
                      onClick={() => runProgram(p.trigger, p.label, 'run')}
                      disabled={programBusy !== null}
                      className="px-3 py-1.5 rounded-lg text-sm font-medium bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {programBusy === `${p.trigger}:run` ? '…' : 'Run now'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          {programMessage && (
            <p className={`text-sm mt-3 ${programMessage.toLowerCase().includes('fail') || programMessage.includes('error') ? 'text-red-500' : 'text-green-600'}`}>
              {programMessage}
            </p>
          )}
        </div>

        {/* Growth: by source + recent signups */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-3">Subscribers by Source</h2>
            {allSources.length === 0 ? (
              <p className="text-gray-400 text-sm">No subscribers yet</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {Object.entries(sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([src, count]) => (
                    <span key={src} className="px-3 py-1 rounded-full bg-violet-50 text-violet-800 text-sm font-medium">
                      {src}: {count}
                    </span>
                  ))}
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" /> New signups (30d)
            </h2>
            <p className="text-2xl font-bold text-gray-900 mb-3">{signupsTotal30}</p>
            <div className="flex items-end gap-0.5 h-16">
              {signups30.map((n, i) => {
                const max = Math.max(1, ...signups30);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-blue-400"
                    style={{ height: `${Math.max(2, (n / max) * 100)}%` }}
                    title={`${n} signup${n === 1 ? '' : 's'}`}
                  />
                );
              })}
            </div>
          </div>
        </div>

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

        {/* Sender health + email-driven affiliate clicks */}
        {sends.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6 mt-6">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" /> Sender Health
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <HealthTile label="Bounce rate" value={health.bounceRate} warn={health.bounceRate >= 2} />
                <HealthTile label="Complaint rate" value={health.complaintRate} warn={health.complaintRate >= 0.1} />
                <HealthTile label="Unsubscribe rate" value={health.unsubRate} warn={health.unsubRate >= 5} />
                <div className="text-center p-3 rounded-lg bg-emerald-50">
                  <div className="text-2xl font-bold text-emerald-700 flex items-center justify-center gap-1">
                    <MousePointerClick className="w-5 h-5" /> {health.affiliateClicks}
                  </div>
                  <div className="text-xs text-emerald-600">Gear/Tickets clicks</div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mt-3">High complaint or bounce rates threaten Resend sender reputation.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-lg font-bold text-gray-900 mb-3">Performance by Program</h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-gray-200">
                      <th className="pb-2 font-medium text-gray-500">Program</th>
                      <th className="pb-2 font-medium text-gray-500 text-center">Sent</th>
                      <th className="pb-2 font-medium text-gray-500 text-center">Open</th>
                      <th className="pb-2 font-medium text-gray-500 text-center">Click</th>
                      <th className="pb-2 font-medium text-gray-500 text-center">Aff.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programPerf.map(([campaign, a]) => {
                      const rate = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '—');
                      return (
                        <tr key={campaign} className="border-b border-gray-50">
                          <td className="py-2 text-gray-900">{CAMPAIGN_LABEL[campaign] || campaign}</td>
                          <td className="py-2 text-center text-gray-700">{a.sent}</td>
                          <td className="py-2 text-center text-gray-700">{rate(a.opened, a.delivered)}</td>
                          <td className="py-2 text-center text-gray-700">{rate(a.clicked, a.delivered)}</td>
                          <td className="py-2 text-center text-gray-700">{a.affiliateClicks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

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
                    <th className="pb-2 font-medium text-gray-500">Program</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Sent</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Delivered</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Opened</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Clicked</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Bounced</th>
                    <th className="pb-2 font-medium text-gray-500 text-center">Complained</th>
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
                        <td className="py-2 text-gray-600 text-xs whitespace-nowrap">{CAMPAIGN_LABEL[campaignOf(send)] || send.team}</td>
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
                        <td className="py-2 text-center">
                          {(send.complained || 0) > 0 ? (
                            <span className="text-red-600 font-semibold">{send.complained}</span>
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
            <h2 className="text-lg font-bold text-gray-900">Subscribers <span className="text-sm font-normal text-gray-400">({filteredSubscribers.length})</span></h2>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
              >
                <option value="all">All status</option>
                <option value="verified">Verified</option>
                <option value="pending">Pending</option>
                <option value="unsubscribed">Unsubscribed</option>
              </select>
              <select
                value={filterSource}
                onChange={(e) => setFilterSource(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
              >
                <option value="all">All sources</option>
                {allSources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <select
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm"
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

function HealthTile({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className={`text-center p-3 rounded-lg ${warn ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl font-bold ${warn ? 'text-red-600' : 'text-gray-700'}`}>{value.toFixed(2)}%</div>
      <div className={`text-xs ${warn ? 'text-red-600' : 'text-gray-500'}`}>{label}</div>
    </div>
  );
}
