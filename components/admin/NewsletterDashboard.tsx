'use client';

import { useState, useEffect, useMemo } from 'react';
import { Mail, Users, Send, Download, RefreshCw, Trash2, Power, AlertTriangle, TrendingUp, MousePointerClick, UserMinus } from 'lucide-react';
import {
  Card, PageHeader, SectionHeading, Button, Toggle, Badge, Spinner, StatCard,
  ErrorBanner, Input, Select, SearchInput, Segmented, Table, Th, Td, EmptyState, useToast,
} from './ui';
import { getCronJobs } from '@/lib/cronSchedule';
import type { NewsletterSubscriber, EmailSendRecord } from '@/lib/types';

// Gated email programs (KV flags via /api/blog/settings) with their cron
// trigger type. Schedule text comes from lib/cronSchedule (parsed from
// vercel.json) — never hand-written here. NHL recaps aren't in this list —
// they're sent per-team via Manual Send below.
const PROGRAMS = [
  { key: 'weekly-digest-enabled', trigger: 'weekly-digest', label: 'Weekly Digest' },
  { key: 'mlb-recap-enabled', trigger: 'email-mlb-game-recap', label: 'MLB Game Recap' },
  { key: 'mlb-set-recap-enabled', trigger: 'email-mlb-set-recap', label: 'MLB Set Recap' },
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
const SUBSCRIBER_PAGE_SIZE = 25;
const SENDS_PAGE_SIZE = 20;

type GrowthRange = '30' | '90' | 'all';
type SubSortField = 'date' | 'email' | 'status' | 'source';
type SortDirection = 'asc' | 'desc';

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

function statusOf(s: NewsletterSubscriber): 'verified' | 'pending' | 'unsubscribed' {
  if (s.unsubscribedAt) return 'unsubscribed';
  return s.verified ? 'verified' : 'pending';
}

function statusBadge(s: NewsletterSubscriber) {
  const st = statusOf(s);
  if (st === 'unsubscribed') {
    return (
      <Badge variant="error" title={s.unsubscribedAt ? `Unsubscribed ${new Date(s.unsubscribedAt).toLocaleString()}` : undefined}>
        Unsubscribed
      </Badge>
    );
  }
  if (st === 'verified') {
    return (
      <Badge variant="success" title={s.verifiedAt ? `Verified ${new Date(s.verifiedAt).toLocaleString()}` : undefined}>
        Verified
      </Badge>
    );
  }
  return <Badge variant="warning">Pending</Badge>;
}

export default function NewsletterDashboard() {
  const { toast } = useToast();
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
  const [search, setSearch] = useState('');
  const [filterTeam, setFilterTeam] = useState('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'verified' | 'pending' | 'unsubscribed'>('all');
  const [filterSource, setFilterSource] = useState('all');
  const [sortField, setSortField] = useState<SubSortField>('date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [subPage, setSubPage] = useState(0);
  const [sendsPage, setSendsPage] = useState(0);
  const [growthRange, setGrowthRange] = useState<GrowthRange>('30');
  const [error, setError] = useState<string | null>(null);
  // Schedule facts computed from vercel.json — DST-correct via Intl.
  const cronJobs = useMemo(() => new Map(getCronJobs().map((j) => [j.slug, j])), []);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSubPage(0);
  }, [search, filterTeam, filterStatus, filterSource]);

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
    const weekAgo = Date.now() - 7 * 86400000;
    const newThisWeek = subscribers.filter((s) => new Date(s.createdAt).getTime() >= weekAgo).length;

    const teamCounts: Record<string, number> = {};
    subscribers
      .filter((s) => s.verified && !s.unsubscribedAt)
      .forEach((s) => {
        s.teams.forEach((t) => {
          teamCounts[t] = (teamCounts[t] || 0) + 1;
        });
      });

    return { total, verified, unverified, unsubscribed, newThisWeek, teamCounts };
  }, [subscribers]);

  const sendTotals = useMemo(() => {
    return sends.reduce(
      (acc, s) => ({
        sent: acc.sent + s.recipientCount,
        delivered: acc.delivered + (s.delivered || 0),
        opened: acc.opened + (s.opened || 0),
        clicked: acc.clicked + (s.clicked || 0),
        bounced: acc.bounced + (s.bounced || 0),
      }),
      { sent: 0, delivered: 0, opened: 0, clicked: 0, bounced: 0 }
    );
  }, [sends]);

  const filteredSubscribers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = subscribers.filter((s) => {
      if (q && !s.email.toLowerCase().includes(q)) return false;
      if (filterTeam !== 'all' && !s.teams.includes(filterTeam)) return false;
      if (filterSource !== 'all' && (s.source || '—') !== filterSource) return false;
      if (filterStatus !== 'all' && statusOf(s) !== filterStatus) return false;
      return true;
    });

    result.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'email') cmp = a.email.localeCompare(b.email);
      else if (sortField === 'status') cmp = statusOf(a).localeCompare(statusOf(b));
      else if (sortField === 'source') cmp = (a.source || '').localeCompare(b.source || '');
      else cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sortDirection === 'desc' ? -cmp : cmp;
    });
    return result;
  }, [subscribers, search, filterTeam, filterSource, filterStatus, sortField, sortDirection]);

  const subPageCount = Math.max(1, Math.ceil(filteredSubscribers.length / SUBSCRIBER_PAGE_SIZE));
  const currentSubPage = Math.min(subPage, subPageCount - 1);
  const pageSubscribers = filteredSubscribers.slice(
    currentSubPage * SUBSCRIBER_PAGE_SIZE,
    currentSubPage * SUBSCRIBER_PAGE_SIZE + SUBSCRIBER_PAGE_SIZE
  );

  const sendsPageCount = Math.max(1, Math.ceil(sends.length / SENDS_PAGE_SIZE));
  const currentSendsPage = Math.min(sendsPage, sendsPageCount - 1);
  const pageSends = sends.slice(
    currentSendsPage * SENDS_PAGE_SIZE,
    currentSendsPage * SENDS_PAGE_SIZE + SENDS_PAGE_SIZE
  );

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

  // Signup buckets for the growth chart. 30/90 days are daily bars; "all" is
  // weekly bars from the first signup so long histories stay readable.
  const growth = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (growthRange !== 'all') {
      const days = growthRange === '30' ? 30 : 90;
      const buckets = new Array(days).fill(0);
      subscribers.forEach((s) => {
        const d = new Date(s.createdAt);
        d.setHours(0, 0, 0, 0);
        const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
        if (diff >= 0 && diff < days) buckets[days - 1 - diff] += 1;
      });
      return { buckets, unit: 'day' as const };
    }
    if (subscribers.length === 0) return { buckets: [] as number[], unit: 'week' as const };
    const first = Math.min(...subscribers.map((s) => new Date(s.createdAt).getTime()));
    const weeks = Math.max(1, Math.ceil((today.getTime() - first) / (7 * 86400000)) + 1);
    const buckets = new Array(weeks).fill(0);
    subscribers.forEach((s) => {
      const diff = Math.floor((today.getTime() - new Date(s.createdAt).getTime()) / (7 * 86400000));
      if (diff >= 0 && diff < weeks) buckets[weeks - 1 - diff] += 1;
    });
    return { buckets, unit: 'week' as const };
  }, [subscribers, growthRange]);
  const growthTotal = useMemo(() => growth.buckets.reduce((a, b) => a + b, 0), [growth]);

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
        toast('Subscriber deleted', 'info');
      }
    } catch {
      // ignore
    }
  }

  // Exports what's on screen: current filters + sort.
  function exportCSV() {
    const csv = [
      'email,teams,status,subscribed_at,source',
      ...filteredSubscribers.map(
        (s) => `${s.email},"${s.teams.join(', ')}",${statusOf(s)},${s.createdAt},${s.source || ''}`
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `subscribers-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function sortProps(field: SubSortField) {
    return {
      direction: sortField === field ? sortDirection : null,
      onClick: () => {
        if (sortField === field) setSortDirection((d) => (d === 'desc' ? 'asc' : 'desc'));
        else {
          setSortField(field);
          setSortDirection(field === 'date' ? 'desc' : 'asc');
        }
      },
    };
  }

  const formatDateTime = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
    });

  if (loading) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex justify-center py-12">
          <Spinner size="lg" />
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="mx-auto max-w-7xl px-4 py-8">
        <div className="mx-auto max-w-lg space-y-4 text-center">
          <ErrorBanner>{error}</ErrorBanner>
          <Button variant="ghost" onClick={loadData}>Retry</Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-8">
      <PageHeader
        title="Subscribers"
        description={`${stats.verified} active subscriber${stats.verified !== 1 ? 's' : ''} across ${allTeams.length} team${allTeams.length !== 1 ? 's' : ''}`}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={exportCSV}>
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={loadData} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard icon={<Users className="h-5 w-5" />} label="Verified" value={stats.verified} sub={`${stats.unverified} pending`} />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="New this week"
          value={stats.newThisWeek}
          delta={stats.newThisWeek > 0 ? { value: stats.newThisWeek, label: 'last 7 days' } : undefined}
        />
        <StatCard icon={<UserMinus className="h-5 w-5" />} label="Unsubscribed" value={stats.unsubscribed} sub="all time" />
        <StatCard
          icon={<Mail className="h-5 w-5" />}
          label="Open rate"
          value={sendTotals.delivered > 0 ? `${((sendTotals.opened / sendTotals.delivered) * 100).toFixed(1)}%` : '—'}
          sub={sendTotals.delivered > 0 ? `${((sendTotals.clicked / sendTotals.delivered) * 100).toFixed(1)}% click rate` : 'no sends yet'}
        />
      </div>

      {/* Subscribers table — the main event, right at the top */}
      <Card className="mb-6" padding={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 p-4 sm:p-5">
          <SearchInput
            placeholder="Search email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-60"
          />
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)} className="!w-auto">
            <option value="all">All status</option>
            <option value="verified">Verified</option>
            <option value="pending">Pending</option>
            <option value="unsubscribed">Unsubscribed</option>
          </Select>
          <Select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} className="!w-auto">
            <option value="all">All sources</option>
            {allSources.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select value={filterTeam} onChange={(e) => setFilterTeam(e.target.value)} className="!w-auto">
            <option value="all">All teams</option>
            {allTeams.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <span className="ml-auto text-sm text-gray-400">
            {filteredSubscribers.length} of {subscribers.length}
          </span>
        </div>

        {filteredSubscribers.length === 0 ? (
          <EmptyState>No matching subscribers</EmptyState>
        ) : (
          <>
            {/* Mobile: card layout */}
            <div className="divide-y divide-gray-100 sm:hidden">
              {pageSubscribers.map((sub) => (
                <div key={sub.id} className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="break-all text-sm font-medium text-gray-900">{sub.email}</div>
                    <button
                      onClick={() => handleDelete(sub.id, sub.email)}
                      className="ml-2 shrink-0 text-gray-400 transition-colors hover:text-red-500"
                      title="Delete subscriber"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {statusBadge(sub)}
                    <span className="text-gray-400">{sub.source || '—'}</span>
                    <span className="text-gray-400">{formatDateTime(sub.createdAt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">{sub.teams.join(', ')}</div>
                </div>
              ))}
            </div>

            {/* Desktop: table layout */}
            <div className="hidden sm:block">
              <Table>
                <thead>
                  <tr>
                    <Th sort={sortProps('email')}>Email</Th>
                    <Th>Teams</Th>
                    <Th sort={sortProps('status')}>Status</Th>
                    <Th sort={sortProps('source')}>Source</Th>
                    <Th sort={sortProps('date')}>Subscribed</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {pageSubscribers.map((sub) => (
                    <tr key={sub.id} className="transition-colors hover:bg-gray-50">
                      <Td className="font-medium text-gray-900">{sub.email}</Td>
                      <Td className="text-gray-500">{sub.teams.join(', ')}</Td>
                      <Td>{statusBadge(sub)}</Td>
                      <Td className="text-gray-500">{sub.source || '—'}</Td>
                      <Td className="whitespace-nowrap text-gray-500">{formatDateTime(sub.createdAt)}</Td>
                      <Td align="right">
                        <button
                          onClick={() => handleDelete(sub.id, sub.email)}
                          className="text-gray-400 transition-colors hover:text-red-500"
                          title="Delete subscriber"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>

            {subPageCount > 1 && (
              <div className="flex items-center justify-between border-t border-gray-100 p-3">
                <Button variant="secondary" size="sm" onClick={() => setSubPage((p) => Math.max(0, p - 1))} disabled={currentSubPage === 0}>
                  Previous
                </Button>
                <span className="text-sm text-gray-500">Page {currentSubPage + 1} of {subPageCount}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setSubPage((p) => Math.min(subPageCount - 1, p + 1))}
                  disabled={currentSubPage >= subPageCount - 1}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </Card>

      {/* Growth + breakdowns */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <SectionHeading
            actions={
              <Segmented
                options={[
                  { value: '30', label: '30d' },
                  { value: '90', label: '90d' },
                  { value: 'all', label: 'All' },
                ]}
                value={growthRange}
                onChange={setGrowthRange}
              />
            }
          >
            Signups
          </SectionHeading>
          <p className="mb-3 text-2xl font-bold text-gray-900">
            {growthTotal}
            <span className="ml-2 text-sm font-normal text-gray-400">
              {growthRange === 'all' ? 'all time (weekly bars)' : `last ${growthRange} days`}
            </span>
          </p>
          {growth.buckets.length === 0 ? (
            <EmptyState>No subscribers yet</EmptyState>
          ) : (
            <div className="flex h-16 items-end gap-0.5">
              {growth.buckets.map((n, i) => {
                const max = Math.max(1, ...growth.buckets);
                return (
                  <div
                    key={i}
                    className="flex-1 rounded-t bg-sabres-blue"
                    style={{ height: `${Math.max(2, (n / max) * 100)}%`, opacity: n === 0 ? 0.15 : 1 }}
                    title={`${n} signup${n === 1 ? '' : 's'}`}
                  />
                );
              })}
            </div>
          )}
        </Card>
        <Card>
          <SectionHeading>Breakdown</SectionHeading>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">By team</p>
          {Object.keys(stats.teamCounts).length === 0 ? (
            <p className="mb-4 text-sm text-gray-400">No verified subscribers yet</p>
          ) : (
            <div className="mb-4 flex flex-wrap gap-2">
              {Object.entries(stats.teamCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([team, count]) => (
                  <Badge key={team} variant="info">{team}: {count}</Badge>
                ))}
            </div>
          )}
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">By source</p>
          {allSources.length === 0 ? (
            <p className="text-sm text-gray-400">No subscribers yet</p>
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
      </div>

      {/* Programs + manual send */}
      <div className="mb-6 grid gap-6 md:grid-cols-2">
        <Card>
          <SectionHeading>
            <span className="flex items-center gap-2"><Power className="h-4 w-4" /> Email Programs</span>
          </SectionHeading>
          <p className="mb-3 text-sm text-gray-500">Enable, test, or run the automated sends. Off = the cron skips real delivery.</p>
          <label className="mb-2 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <span>Test address:</span>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => updateTestEmail(e.target.value)}
              placeholder="you@example.com"
              className="!w-64 max-w-full"
            />
            {!testEmail && <span className="text-xs text-gray-400">Required for Test buttons</span>}
          </label>
          <div className="divide-y divide-gray-100">
            {PROGRAMS.map((p) => {
              const on = !!programs[p.key];
              return (
                <div key={p.key} className="flex flex-col justify-between gap-3 py-3 sm:flex-row sm:items-center">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{p.label}</div>
                    {cronJobs.get(p.trigger) && (
                      <div className="text-xs text-gray-400">
                        {cronJobs.get(p.trigger)!.humanSchedule} · next {cronJobs.get(p.trigger)!.nextRunLabel}
                      </div>
                    )}
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
            <p className={`mt-3 text-sm ${programMessage.toLowerCase().includes('fail') || programMessage.includes('error') ? 'text-red-600' : 'text-green-700'}`}>
              {programMessage}
            </p>
          )}
        </Card>

        <Card>
          <SectionHeading>
            <span className="flex items-center gap-2"><Send className="h-4 w-4" /> Manual Send</span>
          </SectionHeading>
          <p className="mb-3 text-sm text-gray-500">
            {sendType === 'announcement'
              ? 'Send a product update to every verified subscriber.'
              : "Send an email recap for a team's most recent game or completed set."}
          </p>
          <Segmented
            className="mb-3"
            options={[
              { value: 'game-recap', label: 'Game Recap' },
              { value: 'set-recap', label: 'Set Recap' },
              { value: 'announcement', label: 'Announcement' },
            ]}
            value={sendType}
            onChange={(v) => { setSendType(v); setSendMessage(''); }}
          />
          <div className="flex flex-col gap-2 sm:flex-row">
            {sendType === 'announcement' ? (
              <Select
                value={announcementSlug}
                onChange={(e) => { setAnnouncementSlug(e.target.value); setSendMessage(''); }}
                className="flex-1"
              >
                <option value="road-to-cup-launch">Road to the Cup + Sabres History launch</option>
              </Select>
            ) : (
              <Select
                value={sendTeam}
                onChange={(e) => { setSendTeam(e.target.value); setSendMessage(''); }}
                className="flex-1"
              >
                <option value="">Select a team...</option>
                {allTeams.map((t) => (
                  <option key={t} value={t}>{t} ({stats.teamCounts[t] || 0} subscribers)</option>
                ))}
              </Select>
            )}
            <Button
              variant={testMode ? 'secondary' : 'primary'}
              onClick={handleManualSend}
              disabled={sending || (sendType !== 'announcement' && !sendTeam) || (testMode && !testEmail)}
            >
              {sending ? <Spinner size="sm" /> : testMode ? 'Send Test' : 'Send'}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-700">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={testMode}
                onChange={(e) => { setTestMode(e.target.checked); setSendMessage(''); }}
                className="h-4 w-4 rounded border-gray-300 accent-sabres-blue"
              />
              <span>Test mode — send only to</span>
            </label>
            <Input
              type="email"
              value={testEmail}
              onChange={(e) => updateTestEmail(e.target.value)}
              placeholder="you@example.com"
              className="!w-56 max-w-full"
            />
          </div>
          {sendMessage && (
            <p className={`mt-2 text-sm ${sendMessage.includes('error') || sendMessage.includes('Failed') ? 'text-red-600' : 'text-green-700'}`}>
              {sendMessage}
            </p>
          )}
        </Card>
      </div>

      {/* Recent Sends */}
      {sends.length > 0 && (
        <Card className="mb-6" padding={false}>
          <div className="p-4 pb-0 sm:p-5 sm:pb-0">
            <SectionHeading>Recent Sends</SectionHeading>
          </div>
          {/* Mobile: card layout */}
          <div className="divide-y divide-gray-100 sm:hidden">
            {pageSends.map((send) => {
              const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
              const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) + '%' : '—';
              return (
                <div key={send.id} className="p-4">
                  <div className="mb-1 truncate text-sm font-medium text-gray-900">{send.subject}</div>
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-400">
                    <span>{CAMPAIGN_LABEL[campaignOf(send)] || send.team}</span>
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
                      <div className={`font-semibold ${(send.bounced || 0) > 0 ? 'text-red-500' : 'text-gray-400'}`}>{send.bounced || 0}</div>
                      <div className="text-gray-400">Bounced</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop: table layout */}
          <div className="hidden sm:block">
            <Table>
              <thead>
                <tr>
                  <Th>Subject</Th>
                  <Th>Program</Th>
                  <Th align="center">Sent</Th>
                  <Th align="center">Delivered</Th>
                  <Th align="center">Opened</Th>
                  <Th align="center">Clicked</Th>
                  <Th align="center">Bounced</Th>
                  <Th align="center">Complained</Th>
                  <Th align="center" className="whitespace-nowrap">Aff. clicks</Th>
                  <Th>Date</Th>
                </tr>
              </thead>
              <tbody>
                {pageSends.map((send) => {
                  const openRate = (send.delivered || 0) > 0 ? ((send.opened || 0) / send.delivered! * 100).toFixed(0) : '—';
                  const clickRate = (send.delivered || 0) > 0 ? ((send.clicked || 0) / send.delivered! * 100).toFixed(0) : '—';
                  return (
                    <tr key={send.id} className="transition-colors hover:bg-gray-50">
                      <Td className="max-w-[220px] truncate font-medium text-gray-900" >{send.subject}</Td>
                      <Td className="whitespace-nowrap text-xs text-gray-500">{CAMPAIGN_LABEL[campaignOf(send)] || send.team}</Td>
                      <Td align="center">{send.recipientCount}</Td>
                      <Td align="center">{send.delivered || 0}</Td>
                      <Td align="center">
                        {send.opened || 0}
                        {openRate !== '—' && <span className="ml-1 text-xs text-gray-400">({openRate}%)</span>}
                      </Td>
                      <Td align="center">
                        {send.clicked || 0}
                        {clickRate !== '—' && <span className="ml-1 text-xs text-gray-400">({clickRate}%)</span>}
                      </Td>
                      <Td align="center">
                        <span className={(send.bounced || 0) > 0 ? 'text-red-500' : 'text-gray-400'}>{send.bounced || 0}</span>
                      </Td>
                      <Td align="center">
                        <span className={(send.complained || 0) > 0 ? 'font-semibold text-red-500' : 'text-gray-400'}>{send.complained || 0}</span>
                      </Td>
                      <Td align="center">
                        <span className={send.affiliateClicks ? 'text-emerald-600' : 'text-gray-400'}>{send.affiliateClicks || 0}</span>
                      </Td>
                      <Td className="whitespace-nowrap text-xs text-gray-500">{new Date(send.sentAt).toLocaleDateString()}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </div>

          {sendsPageCount > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 p-3">
              <Button variant="secondary" size="sm" onClick={() => setSendsPage((p) => Math.max(0, p - 1))} disabled={currentSendsPage === 0}>
                Previous
              </Button>
              <span className="text-sm text-gray-500">Page {currentSendsPage + 1} of {sendsPageCount}</span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSendsPage((p) => Math.min(sendsPageCount - 1, p + 1))}
                disabled={currentSendsPage >= sendsPageCount - 1}
              >
                Next
              </Button>
            </div>
          )}
        </Card>
      )}

      {/* Sender health + per-program performance */}
      {sends.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <SectionHeading>
              <span className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Sender Health</span>
            </SectionHeading>
            <div className="grid grid-cols-2 gap-3">
              <HealthTile label="Bounce rate" value={health.bounceRate} warn={health.bounceRate >= 2} />
              <HealthTile label="Complaint rate" value={health.complaintRate} warn={health.complaintRate >= 0.1} />
              <HealthTile label="Unsubscribe rate" value={health.unsubRate} warn={health.unsubRate >= 5} />
              <div className="rounded-lg bg-emerald-50 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-2xl font-bold text-emerald-600">
                  <MousePointerClick className="h-5 w-5" /> {health.affiliateClicks}
                </div>
                <div className="text-xs text-emerald-700">Gear/Tickets clicks</div>
              </div>
            </div>
            <p className="mt-3 text-xs text-gray-400">High complaint or bounce rates threaten Resend sender reputation.</p>
          </Card>

          <Card>
            <SectionHeading>Performance by Program</SectionHeading>
            <Table>
              <thead>
                <tr>
                  <Th>Program</Th>
                  <Th align="center">Sent</Th>
                  <Th align="center">Open</Th>
                  <Th align="center">Click</Th>
                  <Th align="center">Aff.</Th>
                </tr>
              </thead>
              <tbody>
                {programPerf.map(([campaign, a]) => {
                  const rate = (n: number, d: number) => (d > 0 ? `${((n / d) * 100).toFixed(0)}%` : '—');
                  return (
                    <tr key={campaign}>
                      <Td className="font-medium text-gray-900">{CAMPAIGN_LABEL[campaign] || campaign}</Td>
                      <Td align="center">{a.sent}</Td>
                      <Td align="center">{rate(a.opened, a.delivered)}</Td>
                      <Td align="center">{rate(a.clicked, a.delivered)}</Td>
                      <Td align="center">{a.affiliateClicks || '—'}</Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </div>
      )}
    </main>
  );
}

function HealthTile({ label, value, warn }: { label: string; value: number; warn: boolean }) {
  return (
    <div className={`rounded-lg p-3 text-center ${warn ? 'bg-red-50' : 'bg-gray-50'}`}>
      <div className={`text-2xl font-bold ${warn ? 'text-red-500' : 'text-gray-800'}`}>{value.toFixed(2)}%</div>
      <div className={`text-xs ${warn ? 'text-red-500' : 'text-gray-400'}`}>{label}</div>
    </div>
  );
}
