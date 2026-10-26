'use client';

import { useEffect, useMemo, useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Card, SectionHeading, Segmented, Spinner, Table, Th, Td, EmptyState } from './ui';
import type { EmailEvent } from '@/lib/emailEvents';
import type { EmailSendRecord, NewsletterSubscriber } from '@/lib/types';

const KIND_LABEL: Record<string, string> = {
  gameRecaps: 'Game recaps',
  setRecaps: 'Set recaps',
  digest: 'Weekly digest',
  specials: 'Specials',
};

const EVENT_LABEL: Record<string, string> = {
  subscribed: 'Signed up',
  confirmed: 'Confirmed',
  resubscribed: 'Came back',
  unsubscribed: 'Unsubscribed',
  'kind-off': 'Turned off',
  'kind-on': 'Turned on',
  'team-off': 'Dropped team',
  'team-on': 'Added team',
  complained: 'Marked spam',
  bounced: 'Bounced',
};

const LEFT = new Set(['unsubscribed', 'complained', 'bounced']);
const NARROWED = new Set(['kind-off', 'team-off']);

type Range = '30' | '90';

/** Where opt-outs come from: each unsubscribe link carries the email it was in. */
export default function EmailChurnPanel({
  subscribers,
  sends,
  campaignOf,
  campaignLabel,
}: {
  subscribers: NewsletterSubscriber[];
  sends: EmailSendRecord[];
  campaignOf: (s: EmailSendRecord) => string;
  campaignLabel: Record<string, string>;
}) {
  const [range, setRange] = useState<Range>('30');
  const [events, setEvents] = useState<EmailEvent[] | null>(null);

  useEffect(() => {
    setEvents(null);
    fetch(`/api/newsletter/subscribers?type=events&days=${range}`, { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((d) => setEvents(d.events || []))
      .catch(() => setEvents([]));
  }, [range]);

  const emailOf = useMemo(() => new Map(subscribers.map((s) => [s.id, s.email])), [subscribers]);

  const summary = useMemo(() => {
    if (!events) return null;
    const since = Date.now() - Number(range) * 86_400_000;
    const sentBy: Record<string, number> = {};
    for (const s of sends) {
      if (Date.parse(s.sentAt) >= since) sentBy[campaignOf(s)] = (sentBy[campaignOf(s)] || 0) + (s.delivered || s.recipientCount || 0);
    }

    type Row = { left: number; spam: number; narrowed: number };
    const bySource: Record<string, Row> = {};
    const kindsOff: Record<string, number> = {};
    const signupSources: Record<string, number> = {};
    const tenure: number[] = [];
    let signups = 0, confirmed = 0, left = 0, narrowed = 0;

    for (const e of events) {
      if (e.kind === 'subscribed' || e.kind === 'resubscribed') {
        signups++;
        signupSources[e.detail || 'unknown'] = (signupSources[e.detail || 'unknown'] || 0) + 1;
      }
      if (e.kind === 'confirmed') confirmed++;
      if (e.kind === 'kind-off' && e.detail) kindsOff[e.detail] = (kindsOff[e.detail] || 0) + 1;
      if (!LEFT.has(e.kind) && !NARROWED.has(e.kind)) continue;
      if (e.kind === 'bounced') continue; // a dead inbox, not a choice
      const source = e.campaign ?? (e.via === 'email-link' || e.via === 'one-click' ? 'unknown-email' : `site:${e.via}`);
      const row = (bySource[source] ??= { left: 0, spam: 0, narrowed: 0 });
      if (NARROWED.has(e.kind)) { row.narrowed++; narrowed++; }
      else {
        left++;
        if (e.kind === 'complained') row.spam++;
        else row.left++;
        if (e.daysSubscribed !== undefined) tenure.push(e.daysSubscribed);
      }
    }
    tenure.sort((a, b) => a - b);
    const rows = Object.entries(bySource)
      .map(([source, r]) => ({ source, ...r, sent: sentBy[source] || 0 }))
      .sort((a, b) => b.left + b.spam + b.narrowed - (a.left + a.spam + a.narrowed));
    return {
      signups, confirmed, left, narrowed, rows,
      medianDays: tenure.length ? tenure[Math.floor(tenure.length / 2)] : null,
      kindsOff: Object.entries(kindsOff).sort((a, b) => b[1] - a[1]),
      signupSources: Object.entries(signupSources).sort((a, b) => b[1] - a[1]),
    };
  }, [events, sends, range, campaignOf]);

  const sourceLabel = (source: string) => {
    if (source === 'unknown-email') return 'An email (sent before tracking)';
    if (source === 'site:account') return 'Account settings';
    if (source === 'site:account-delete') return 'Deleted account';
    if (source.startsWith('site:')) return 'On the site';
    return campaignLabel[source] || source;
  };

  return (
    <Card className="mb-6">
      <SectionHeading
        actions={
          <Segmented
            options={[{ value: '30', label: '30d' }, { value: '90', label: '90d' }]}
            value={range}
            onChange={setRange}
          />
        }
      >
        <span className="flex items-center gap-2"><UserMinus className="h-4 w-4" /> Opt-ins &amp; Opt-outs</span>
      </SectionHeading>

      {!summary ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : events!.length === 0 ? (
        <EmptyState>No signups or opt-outs logged yet. Tracking started Oct 26, 2026.</EmptyState>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label="Signups" value={summary.signups} />
            <Tile label="Confirmed" value={summary.confirmed} />
            <Tile label="Left (incl. spam)" value={summary.left} sub={summary.medianDays !== null ? `median ${summary.medianDays}d subscribed` : undefined} />
            <Tile label="Cut back" value={summary.narrowed} sub="kind or team off" />
          </div>

          {summary.rows.length > 0 && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Where they left from</h4>
              <Table>
                <thead>
                  <tr>
                    <Th>Email</Th>
                    <Th align="center">Sent</Th>
                    <Th align="center">Unsub</Th>
                    <Th align="center">Spam</Th>
                    <Th align="center">Cut back</Th>
                    <Th align="center">Per 1k</Th>
                  </tr>
                </thead>
                <tbody>
                  {summary.rows.map((r) => (
                    <tr key={r.source}>
                      <Td className="font-medium text-gray-900">{sourceLabel(r.source)}</Td>
                      <Td align="center">{r.sent || '—'}</Td>
                      <Td align="center">{r.left || '—'}</Td>
                      <Td align="center" className={r.spam ? 'font-semibold text-red-500' : ''}>{r.spam || '—'}</Td>
                      <Td align="center">{r.narrowed || '—'}</Td>
                      <Td align="center">{r.sent ? (((r.left + r.spam) / r.sent) * 1000).toFixed(1) : '—'}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <p className="mt-2 text-xs text-gray-400">Per 1k = unsubscribes + spam reports per 1,000 delivered. Cut back = turned off one kind of email or dropped a team but stayed.</p>
            </div>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            {summary.kindsOff.length > 0 && (
              <List title="Kinds switched off" rows={summary.kindsOff.map(([k, n]) => [KIND_LABEL[k] || k, n])} />
            )}
            {summary.signupSources.length > 0 && (
              <List title="Signups by source" rows={summary.signupSources} />
            )}
          </div>

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Recent activity</h4>
            <ul className="divide-y divide-gray-100 text-sm">
              {events!.slice(0, 25).map((e, i) => (
                <li key={i} className="flex flex-wrap items-baseline gap-x-2 py-1.5">
                  <span className="w-24 shrink-0 text-xs text-gray-400">
                    {new Date(e.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'America/New_York' })}{' '}
                    {new Date(e.at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })}
                  </span>
                  <span className={`font-medium ${LEFT.has(e.kind) ? 'text-red-600' : NARROWED.has(e.kind) ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {EVENT_LABEL[e.kind] || e.kind}
                    {e.kind.startsWith('kind-') && e.detail ? ` ${KIND_LABEL[e.detail] || e.detail}` : ''}
                    {e.team ? ` ${e.team}` : ''}
                  </span>
                  <span className="break-all text-gray-700">{emailOf.get(e.subscriberId) || 'deleted subscriber'}</span>
                  <span className="text-xs text-gray-400">
                    {e.campaign ? `from ${campaignLabel[e.campaign] || e.campaign}` : e.kind === 'subscribed' || e.kind === 'resubscribed' ? `via ${e.detail || 'unknown'}` : ''}
                    {e.daysSubscribed !== undefined ? ` · ${e.daysSubscribed}d in` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </Card>
  );
}

function Tile({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded-lg bg-gray-50 p-3 text-center">
      <div className="text-2xl font-bold text-gray-800">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-400">{sub}</div>}
    </div>
  );
}

function List({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h4>
      <ul className="space-y-1 text-sm">
        {rows.map(([label, n]) => (
          <li key={label} className="flex justify-between"><span className="text-gray-700">{label}</span><span className="font-semibold text-gray-900">{n}</span></li>
        ))}
      </ul>
    </div>
  );
}
