'use client';

import { useState, useEffect, useMemo } from 'react';
import { Mail, Users, Send, Download, RefreshCw, Trash2, Power, AlertTriangle, TrendingUp, MousePointerClick } from 'lucide-react';
import { Card, SectionHeading, Button, Toggle, Badge, Spinner, StatCard, ErrorBanner } from './ui';
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

const TEST_EMAIL_STORAGE_KEY = 'admin-test-email';

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
  const [subscribers, setSubscribers] = useState<NewsletterSubscriber[]>([]);
  const [sends, setSends] = useState<EmailSendRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendTeam, setSendTeam] = useState('');
  const [sendType, setSendType] = useState<'game-recap' | 'set-recap' | 'announcement'>('game-recap');
  const [announcementSlug, setAnnouncementSlug] = useState('road-to-cup-launch');
  const [sending, setSending] = useState(false);
  const [sendMessage, setSendMessage] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending' | 'unsubscribed'>('all');
  const [filterSource, setFilterSource] = useState('all');
  const [error, setError] = useState<string | null>(null);
  // Email program toggles + per-program busy state for test/run buttons.
  const [programs, setPrograms] = useState<Record<string, boolean>>({});
  const [programBusy, setProgramBusy] = useState<string | null>(null);
  const [programMessage, setProgramMessage] = useState('');

  useEffect(() => {
    try {
      setTestEmail(localStorage.getItem(TEST_EMAIL_STORAGE_KEY) || '');
    } catch {
      /* localStorage unavailable */
    }
    loadData();
  }, []);

  function updateTestEmail(value: string) {
    setTestEmail(value);
    try {
      localStorage.setItem(TEST_EMAIL_STORAGE_KEY, value);
    } catch {
      /* localStorage unavailable */
    }
  }

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
    if (testMode && !testEmail) return;
    setSending(true);
    setSendMessage('');
    try {
      const payload: Record<string, unknown> = { type: sendType };
      if (sendType === 'announcement') {
        payload.announcementSlug = announcementSlug;
      } else {
        payload.team = sendTeam;
      }
      if (testMode) payload.testEmail = testEmail;
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

  // Test (to the saved test address) or real "Run now" for a program, via the cron trigger.
  async function runProgram(trigger: string, label: string, mode: 'test' | 'run') {
    if (mode === 'test' && !testEmail) return;
    if (mode === 'run' && !confirm(`Run "${label}" now? This sends real emails to the list.`)) return;
    setProgramBusy(`${trigger}:${mode}`);
    setProgramMessage('');
    try {
      const res = await fetch('/api/cron/trigger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(mode === 'test' ? { type: trigger, test: testEmail } : { type: trigger }),
      });
      const data = await res.json();
      setProgramMessage(
        res.ok
          ? mode === 'test'
            ? `${label}: test sent to ${testEmail}`
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

  const inputClasses = 'px-3 py-1.5 rounded-lg bg-slate-700 border border-slate-600 text-white text-sm focus:outline-none focus:border-sabres-gold';

  if (loading) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="max-w-lg mx-auto text-center space-y-4">
          <ErrorBanner>{error}</ErrorBanner>
          <Button variant="ghost" onClick={loadData}>Retry</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 py-8">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users className="w-5 h-5" />} label="Total" value={stats.total} />
        <StatCard icon={<Mail className="w-5 h-5" />} label="Verified" value={stats.verified} />
        <StatCard icon={<Mail className="w-5 h-5" />} label="Unverified" value={stats.unverified} />
        <StatCard icon={<Send className="w-5 h-5" />} label="Emails Sent" value={sends.reduce((sum, s) => sum + s.recipientCount, 0)} />
      </div>

      {/* Team Breakdown */}
      {Object.keys(stats.teamCounts).length > 0 && (
        <Card className="mb-8">
          <SectionHeading>Subscribers by Team</SectionHeading>
          <div className="flex flex-wrap gap-2">
            {Object.entries(stats.teamCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([team, count]) => (
                <Badge key={team} variant="info">{team}: {count}</Badge>
              ))}
          </div>
        </Card>
      )}

      {/* Email Programs */}
      <Card className="mb-8">
        <SectionHeading className="flex items-center gap-2">
          <Power className="w-5 h-5" /> Email Programs
        </SectionHeading>
        <p className="text-slate-400 text-sm mb-3">Enable, test, or run the automated sends. Off = the cron skips real delivery.</p>
        <label className="flex flex-wrap items-center gap-2 mb-2 text-sm text-slate-300">
          <span>Test address:</span>
          <input
            type="email"
            value={testEmail}
            onChange={(e) => updateTestEmail(e.target.value)}
            placeholder="you@example.com"
            className={`${inputClasses} w-64 max-w-full`}
          />
          {!testEmail && <span className="text-xs text-slate-500">Required for Test buttons</span>}
        </label>
        <div className="divide-y divide-slate-700">
          {PROGRAMS.map((p) => {
            const on = !!programs[p.key];
            return (
              <div key={p.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3">
                <div>
                  <div className="font-medium text-white">{p.label}</div>
                  <div className="text-xs text-slate-500">{p.schedule}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Toggle checked={on} onChange={() => toggleProgram(p.key, !on)} />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runProgram(p.trigger, p.label, 'test')}
                    disabled={programBusy !== null || !testEmail}
                    title={testEmail ? `Send a test to ${testEmail}` : 'Enter a test address above'}
                  >
                    {programBusy === `${p.trigger}:test` ? <Spinner size="sm" /> : 'Test'}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => runProgram(p.trigger, p.label, 'run')}
                    disabled={programBusy !== null}
                  >
                    {programBusy === `${p.trigger}:run` ? <Spinner size="sm" /> : 'Run now'}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
        {programMessage && (
          <p className={`text-sm mt-3 ${programMessage.toLowerCase().includes('fail') || programMessage.includes('error') ? 'text-red-400' : 'text-green-400'}`}>
            {programMessage}
          </p>
        )}
      </Card>

      {/* Growth: by source + recent signups */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <SectionHeading>Subscribers by Source</SectionHeading>
          {allSources.length === 0 ? (
            <p className="text-slate-500 text-sm">No subscribers yet</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {Object.entries(sourceCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([src, count]) => (
                  <Badge key={src} variant="neutral">{src}: {count}</Badge>
                ))}
            </div>
          )}
        </Card>
        <Card>
          <SectionHeading className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5" /> New signups (30d)
          </SectionHeading>
          <p className="text-2xl font-bold text-white mb-3">{signupsTotal30}</p>
          <div className="flex items-end gap-0.5 h-16">
            {signups30.map((n, i) => {
              const max = Math.max(1, ...signups30);
              return (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-sabres-gold"
                  style={{ height: `${Math.max(2, (n / max) * 100)}%` }}
                  title={`${n} signup${n === 1 ? '' : 's'}`}
                />
              );
            })}
          </div>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Manual Send */}
        <Card>
          <SectionHeading className="flex items-center gap-2">
            <Send className="w-5 h-5" /> Manual Send
          </SectionHeading>
          <p className="text-slate-400 text-sm mb-3">
            {sendType === 'announcement'
              ? 'Send a product update to every verified subscriber.'
              : "Send an email recap for a team's most recent game or completed set."}
          </p>
          <div className="flex gap-2 mb-2">
            {([
              ['game-recap', 'Game Recap'],
              ['set-recap', 'Set Recap'],
              ['announcement', 'Announcement'],
            ] as const).map(([type, label]) => (
              <button
                key={type}
                onClick={() => { setSendType(type); setSendMessage(''); }}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sendType === type ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            {sendType === 'announcement' ? (
              <select
                value={announcementSlug}
                onChange={(e) => { setAnnouncementSlug(e.target.value); setSendMessage(''); }}
                className={`flex-1 ${inputClasses} py-2`}
              >
                <option value="road-to-cup-launch">Road to the Cup + Sabres History launch</option>
              </select>
            ) : (
              <select
                value={sendTeam}
                onChange={(e) => { setSendTeam(e.target.value); setSendMessage(''); }}
                className={`flex-1 ${inputClasses} py-2`}
              >
                <option value="">Select a team...</option>
                {allTeams.map((t) => (
                  <option key={t} value={t}>{t} ({stats.teamCounts[t] || 0} subscribers)</option>
                ))}
              </select>
            )}
            <Button
              variant={testMode ? 'primary' : 'secondary'}
              onClick={handleManualSend}
              disabled={sending || (sendType !== 'announcement' && !sendTeam) || (testMode && !testEmail)}
              className="text-sm"
            >
              {sending ? <Spinner size="sm" /> : testMode ? 'Send Test' : 'Send'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3 text-sm text-slate-300">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => { setTestMode(e.target.checked); setSendMessage(''); }}
                className="w-4 h-4 rounded border-slate-600 bg-slate-700 accent-amber-500"
              />
              <span>Test mode — send only to</span>
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => updateTestEmail(e.target.value)}
              placeholder="you@example.com"
              className={`${inputClasses} w-56 max-w-full`}
            />
          </div>
          {sendMessage && (
            <p className={`text-sm mt-2 ${sendMessage.includes('error') || sendMessage.includes('Failed') ? 'text-red-400' : 'text-green-400'}`}>
              {sendMessage}
            </p>
          )}
        </Card>

        {/* Aggregate Stats */}
        <Card>
          <SectionHeading>Email Performance</SectionHeading>
          {sends.length === 0 ? (
            <p className="text-slate-500 text-sm">No emails sent yet</p>
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
                    <div className="text-center p-3 rounded-lg bg-green-600/15">
                      <div className="text-2xl font-bold text-green-400">{pct(totals.delivered, totals.sent)}</div>
                      <div className="text-xs text-green-500">Delivery Rate</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-blue-600/15">
                      <div className="text-2xl font-bold text-blue-400">{pct(totals.opened, totals.delivered)}</div>
                      <div className="text-xs text-blue-500">Open Rate</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-600/15">
                      <div className="text-2xl font-bold text-purple-400">{pct(totals.clicked, totals.delivered)}</div>
                      <div className="text-xs text-purple-500">Click Rate</div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-600/15">
                      <div className="text-2xl font-bold text-red-400">{pct(totals.bounced, totals.sent)}</div>
                      <div className="text-xs text-red-500">Bounce Rate</div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </Card>
      </div>

      {/* Sender health + email-driven affiliate clicks */}
      {sends.length > 0 && (
        <div className="grid md:grid-cols-2 gap-6 mt-6">
          <Card>
            <SectionHeading className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" /> Sender Health
            </SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <HealthTile label="Bounce rate" value={health.bounceRate} warn={health.bounceRate >= 2} />
              <HealthTile label="Complaint rate" value={health.complaintRate} warn={health.complaintRate >= 0.1} />
              <HealthTile label="Unsubscribe rate" value={health.unsubRate} warn={health.unsubRate >= 5} />
              <div className="text-center p-3 rounded-lg bg-emerald-600/15">
                <div className="text-2xl font-bold text-emerald-400 flex items-center justify-center gap-1">
                  <MousePointerClick className="w-5 h-5" /> {health.affiliateClicks}
                </div>
                <div className="text-xs text-emerald-500">Gear/Tickets clicks</div>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">High complaint or bounce rates threaten Resend sender reputation.</p>
          </Card>

          <Card>
            <SectionHeading>Performance by Program</SectionHeading>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="pb-2 font-medium text-slate-400">Program</th>
                    <th className="pb-2 font-medium text-slate-400 text-center">Sent</th>
                    <th className="pb-2 font-medium text-slate-400 text-center">Open</th>
                    <th className="pb-2 font-medium text-slate-400 text-center">Click</th>
                    <th className="pb-2 font-medium text-slate-400 text-center">Aff.</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {programPerf.map(([campaign, a]) => {
                    const rate = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '—');
                    return (
                      <tr key={campaign}>
                        <td className="py-2 text-white">{CAMPAIGN_LABEL[campaign] || campaign}</td>
                        <td className="py-2 text-center text-slate-300">{a.sent}</td>
                        <td className="py-2 text-center text-slate-300">{rate(a.opened, a.delivered)}</td>
                        <td className="py-2 text-center text-slate-300">{rate(a.clicked, a.delivered)}</td>
                        <td className="py-2 text-center text-slate-300">{a.affiliateClicks || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Recent Sends Table */}
      {sends.length > 0 && (
        <Card className="mt-6">
          <SectionHeading>Recent Sends</SectionHeading>
          {/* Mobile: Card layout */}
          <div className="sm:hidden space-y-3">
            {sends.slice(0, 20).map((send) => {
              const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
              const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
              return (
                <div key={send.id} className="border border-slate-700 rounded-lg p-3">
                  <div className="text-sm font-medium text-white truncate mb-1">{send.subject}</div>
                  <div className="flex items-center gap-2 text-xs text-slate-400 mb-2">
                    <span>{send.team}</span>
                    <span>&middot;</span>
                    <span>{new Date(send.sentAt).toLocaleDateString()}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-xs">
                    <div>
                      <div className="font-semibold text-slate-300">{send.recipientCount}</div>
                      <div className="text-slate-500">Sent</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-300">{openRate}</div>
                      <div className="text-slate-500">Opens</div>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-300">{clickRate}</div>
                      <div className="text-slate-500">Clicks</div>
                    </div>
                    <div>
                      <div className={`font-semibold ${(send.bounced || 0) > 0 ? 'text-red-400' : 'text-slate-500'}`}>{send.bounced || 0}</div>
                      <div className="text-slate-500">Bounced</div>
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
                <tr className="text-left border-b border-slate-700">
                  <th className="pb-2 font-medium text-slate-400">Subject</th>
                  <th className="pb-2 font-medium text-slate-400">Program</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Sent</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Delivered</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Opened</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Clicked</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Bounced</th>
                  <th className="pb-2 font-medium text-slate-400 text-center">Complained</th>
                  <th className="pb-2 font-medium text-slate-400">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {sends.slice(0, 20).map((send) => {
                  const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) : '—';
                  const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) : '—';
                  return (
                    <tr key={send.id}>
                      <td className="py-2 text-white max-w-[200px] truncate">{send.subject}</td>
                      <td className="py-2 text-slate-400 text-xs whitespace-nowrap">{CAMPAIGN_LABEL[campaignOf(send)] || send.team}</td>
                      <td className="py-2 text-center text-slate-300">{send.recipientCount}</td>
                      <td className="py-2 text-center text-slate-300">{send.delivered || 0}</td>
                      <td className="py-2 text-center">
                        <span className="text-slate-300">{send.opened || 0}</span>
                        {openRate !== '—' && <span className="text-slate-500 text-xs ml-1">({openRate}%)</span>}
                      </td>
                      <td className="py-2 text-center">
                        <span className="text-slate-300">{send.clicked || 0}</span>
                        {clickRate !== '—' && <span className="text-slate-500 text-xs ml-1">({clickRate}%)</span>}
                      </td>
                      <td className="py-2 text-center">
                        {(send.bounced || 0) > 0 ? (
                          <span className="text-red-400">{send.bounced}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-2 text-center">
                        {(send.complained || 0) > 0 ? (
                          <span className="text-red-400 font-semibold">{send.complained}</span>
                        ) : (
                          <span className="text-slate-500">0</span>
                        )}
                      </td>
                      <td className="py-2 text-slate-400 text-xs whitespace-nowrap">{new Date(send.sentAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Subscribers Table */}
      <Card className="mt-6">
        <SectionHeading>
          Subscribers <span className="text-base font-sans font-normal tracking-normal text-slate-500">({filteredSubscribers.length})</span>
        </SectionHeading>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
            className={inputClasses}
          >
            <option value="all">All status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unsubscribed">Unsubscribed</option>
          </select>
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className={inputClasses}
          >
            <option value="all">All sources</option>
            {allSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className={inputClasses}
          >
            <option value="all">All teams</option>
            {allTeams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <Button variant="ghost" size="sm" onClick={exportCSV}>
            <Download className="w-4 h-4" /> <span className="hidden sm:inline">CSV</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={loadData} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {filteredSubscribers.length === 0 ? (
          <p className="text-slate-500 text-sm text-center py-8">No subscribers yet</p>
        ) : (
          <>
            {/* Mobile: Card layout */}
            <div className="sm:hidden space-y-3">
              {filteredSubscribers.map((sub) => (
                <div key={sub.id} className="border border-slate-700 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="text-sm font-medium text-white break-all">{sub.email}</div>
                    <button
                      onClick={() => handleDelete(sub.id, sub.email)}
                      className="text-slate-500 hover:text-red-400 transition-colors ml-2 shrink-0"
                      title="Delete subscriber"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {sub.unsubscribedAt ? (
                      <Badge variant="error">Unsubscribed</Badge>
                    ) : sub.verified ? (
                      <Badge variant="success">Verified</Badge>
                    ) : (
                      <Badge variant="warning">Pending</Badge>
                    )}
                    <span className="text-slate-500">{sub.source || '-'}</span>
                    <span className="text-slate-500">{new Date(sub.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">{sub.teams.join(', ')}</div>
                </div>
              ))}
            </div>

            {/* Desktop: Table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-slate-700">
                    <th className="pb-2 font-medium text-slate-400">Email</th>
                    <th className="pb-2 font-medium text-slate-400">Teams</th>
                    <th className="pb-2 font-medium text-slate-400">Status</th>
                    <th className="pb-2 font-medium text-slate-400">Source</th>
                    <th className="pb-2 font-medium text-slate-400">Subscribed</th>
                    <th className="pb-2 font-medium text-slate-400"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700">
                  {filteredSubscribers.map((sub) => (
                    <tr key={sub.id}>
                      <td className="py-2 text-white">{sub.email}</td>
                      <td className="py-2 text-slate-400">{sub.teams.join(', ')}</td>
                      <td className="py-2">
                        {sub.unsubscribedAt ? (
                          <Badge variant="error">Unsubscribed</Badge>
                        ) : sub.verified ? (
                          <Badge variant="success">Verified</Badge>
                        ) : (
                          <Badge variant="warning">Pending</Badge>
                        )}
                      </td>
                      <td className="py-2 text-slate-400">{sub.source || '-'}</td>
                      <td className="py-2 text-slate-400">{new Date(sub.createdAt).toLocaleDateString()}</td>
                      <td className="py-2">
                        <button
                          onClick={() => handleDelete(sub.id, sub.email)}
                          className="text-slate-500 hover:text-red-400 transition-colors"
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
      </Card>
    </main>
  );
}

function HealthTile({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className={`text-center p-3 rounded-lg ${warn ? 'bg-red-600/15' : 'bg-slate-700/50'}`}>
      <div className={`text-2xl font-bold ${warn ? 'text-red-400' : 'text-slate-200'}`}>{value.toFixed(2)}%</div>
      <div className={`text-xs ${warn ? 'text-red-400' : 'text-slate-400'}`}>{label}</div>
    </div>
  );
}
