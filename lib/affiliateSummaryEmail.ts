/**
 * Weekly affiliate summary email to the site owner: last 7 days vs the 7 before,
 * per network (Fanatics via Impact, StubHub via Partnerize) plus on-site human
 * clicks, top teams/placements, and recent sales. Sent by /api/cron/affiliate-summary.
 */
import { Resend } from 'resend';
import { fetchImpactSummary, fetchPartnerizeSummary, type NetworkSummary, type NetworkBreakdownRow, type NetworkSale } from '@/lib/services/affiliateNetworks';
import { fetchFirstPartyClicks } from '@/lib/services/affiliateFirstParty';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lindysfive.com';
const FROM_EMAIL = "Lindy's Five <noreply@lindysfive.com>";
export const AFFILIATE_REPORT_TO = process.env.AFFILIATE_REPORT_EMAIL || 'avalonjosh@gmail.com';

interface Period {
  from: Date;
  to: Date;
  networks: NetworkSummary[];
  onSiteClicks: number;
  onSiteByBucket: { name: string; count: number }[];
}

export interface AffiliateWeeklyData {
  current: Period;
  previous: Period;
}

function periodBounds(daysAgoEnd: number, days: number): { from: Date; to: Date } {
  const to = new Date();
  to.setDate(to.getDate() - daysAgoEnd);
  to.setHours(23, 59, 59, 999);
  const from = new Date(to);
  from.setDate(from.getDate() - (days - 1));
  from.setHours(0, 0, 0, 0);
  return { from, to };
}

async function loadPeriod(daysAgoEnd: number): Promise<Period> {
  const { from, to } = periodBounds(daysAgoEnd, 7);
  const [fanatics, stubhub, fp] = await Promise.all([
    fetchImpactSummary(from, to),
    fetchPartnerizeSummary(from, to),
    fetchFirstPartyClicks(7, daysAgoEnd).catch(() => ({ total: 0, byBucket: [], byLabel: [] })),
  ]);
  return { from, to, networks: [fanatics, stubhub], onSiteClicks: fp.total, onSiteByBucket: fp.byBucket };
}

export async function loadAffiliateWeeklyData(): Promise<AffiliateWeeklyData> {
  const [current, previous] = await Promise.all([loadPeriod(0), loadPeriod(7)]);
  return { current, previous };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d: Date) => d.toLocaleDateString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric' });
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function totals(p: Period) {
  return p.networks.reduce(
    (a, n) => ({ clicks: a.clicks + n.clicks, sales: a.sales + n.conversions, orderValue: a.orderValue + n.sales, commission: a.commission + n.commission, pending: a.pending + n.pendingCommission }),
    { clicks: 0, sales: 0, orderValue: 0, commission: 0, pending: 0 },
  );
}

function delta(cur: number, prev: number, fmt: (n: number) => string = (n) => String(n)): string {
  if (prev === 0 && cur === 0) return '<span style="color:#94a3b8;">no change</span>';
  if (prev === 0) return `<span style="color:#16a34a;">new (was 0)</span>`;
  const diff = cur - prev;
  const pct = Math.round((diff / prev) * 100);
  const color = diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#94a3b8';
  const arrow = diff > 0 ? '&#9650;' : diff < 0 ? '&#9660;' : '&#8212;';
  return `<span style="color:${color};">${arrow} ${pct > 0 ? '+' : ''}${pct}% <span style="color:#94a3b8;">(prev ${fmt(prev)})</span></span>`;
}

function statCell(label: string, value: string, sub: string, strong = false): string {
  return `<td width="25%" style="padding:6px;" valign="top">
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px 12px 10px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${label}</div>
      <div style="font-size:22px;font-weight:800;color:${strong ? '#15803d' : '#0f172a'};margin:4px 0 2px;">${value}</div>
      <div style="font-size:11px;line-height:1.4;">${sub}</div>
    </div>
  </td>`;
}

function mergeRows(lists: NetworkBreakdownRow[][], limit: number): NetworkBreakdownRow[] {
  const m = new Map<string, NetworkBreakdownRow>();
  for (const list of lists) for (const r of list) {
    const row = m.get(r.name) || { name: r.name, clicks: 0, conversions: 0, commission: 0 };
    row.clicks += r.clicks; row.conversions += r.conversions; row.commission += r.commission;
    m.set(r.name, row);
  }
  return Array.from(m.values())
    .sort((a, b) => b.commission - a.commission || b.conversions - a.conversions || b.clicks - a.clicks)
    .slice(0, limit);
}

function rowsTable(title: string, rows: NetworkBreakdownRow[]): string {
  if (rows.length === 0) return '';
  const body = rows.map((r) => `
    <tr>
      <td style="padding:5px 0;font-size:13px;color:#334155;border-bottom:1px solid #f1f5f9;">${esc(r.name)}</td>
      <td align="right" style="padding:5px 0;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${r.clicks} clk &middot; ${r.conversions} sale${r.conversions === 1 ? '' : 's'} &middot; <b style="color:#0f172a;">${money(r.commission)}</b></td>
    </tr>`).join('');
  return `<div style="margin-top:18px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:6px;">${title}</div>
    <table width="100%" cellpadding="0" cellspacing="0">${body}</table>
  </div>`;
}

function salesTable(sales: NetworkSale[]): string {
  if (sales.length === 0) return '<p style="margin:8px 0 0;font-size:13px;color:#94a3b8;">No sales this week.</p>';
  const body = sales.map((s) => `
    <tr>
      <td style="padding:5px 0;font-size:12px;color:#64748b;border-bottom:1px solid #f1f5f9;white-space:nowrap;">${fmtDate(new Date(s.date))}</td>
      <td style="padding:5px 6px;font-size:12px;color:#334155;border-bottom:1px solid #f1f5f9;">${s.network === 'fanatics' ? 'Fanatics' : 'StubHub'} &middot; <span style="font-family:monospace;">${esc(s.ref)}</span>${s.detail ? `<br><span style="color:#94a3b8;">${esc(s.detail)}</span>` : ''}</td>
      <td align="right" style="padding:5px 0;font-size:12px;color:#0f172a;border-bottom:1px solid #f1f5f9;white-space:nowrap;"><b>${money(s.commission)}</b><br><span style="color:#94a3b8;">${money(s.amount)} &middot; ${esc(s.status)}</span></td>
    </tr>`).join('');
  return `<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">${body}</table>`;
}

export function renderAffiliateWeeklyEmail(data: AffiliateWeeklyData): { subject: string; html: string } {
  const { current, previous } = data;
  const cur = totals(current);
  const prev = totals(previous);
  const rangeLabel = `${fmtDate(current.from)} – ${fmtDate(current.to)}`;
  const subject = `Affiliates this week: ${money(cur.commission)} · ${cur.sales} sale${cur.sales === 1 ? '' : 's'} · ${current.onSiteClicks} clicks (${rangeLabel})`;

  const networkRows = current.networks.map((n) => {
    const p = previous.networks.find((x) => x.network === n.network);
    const dot = n.error ? '#d97706' : n.configured ? '#16a34a' : '#9ca3af';
    return `<tr>
      <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
        <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dot};margin-right:8px;vertical-align:middle;"></span>
        <span style="font-size:14px;font-weight:600;color:#0f172a;vertical-align:middle;">${n.network === 'fanatics' ? 'Fanatics' : 'StubHub'}</span>
        ${n.error ? `<div style="font-size:11px;color:#d97706;margin-left:16px;">${esc(n.error)}</div>` : ''}
      </td>
      <td align="right" style="padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:12px;color:#64748b;white-space:nowrap;">
        ${n.clicks} clicks &middot; ${n.conversions} sale${n.conversions === 1 ? '' : 's'} &middot; <b style="color:#0f172a;">${money(n.commission)}</b>
        <div style="font-size:11px;">${delta(n.commission, p?.commission ?? 0, money)}</div>
      </td>
    </tr>`;
  }).join('');

  const recentSales = current.networks.flatMap((n) => n.recentSales).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const bucketLine = current.onSiteByBucket.map((b) => `${esc(b.name)} ${b.count}`).join(' &middot; ') || 'none';

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 12px;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
  <tr><td style="background:#003087;padding:20px 24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#93c5fd;">Lindy's Five &middot; Admin</div>
    <div style="font-size:22px;font-weight:800;color:#ffffff;margin-top:4px;">Weekly affiliate summary</div>
    <div style="font-size:13px;color:#bfdbfe;margin-top:2px;">${rangeLabel} &middot; compared with the previous 7 days</div>
  </td></tr>
  <tr><td style="padding:18px 18px 8px;">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      ${statCell('Commission', money(cur.commission), delta(cur.commission, prev.commission, money) + (cur.pending > 0 ? `<br><span style="color:#94a3b8;">${money(cur.pending)} pending</span>` : ''), true)}
      ${statCell('Sales', String(cur.sales), delta(cur.sales, prev.sales) + `<br><span style="color:#94a3b8;">${money(cur.orderValue)} order value</span>`)}
      ${statCell('On-site clicks', String(current.onSiteClicks), delta(current.onSiteClicks, previous.onSiteClicks) + '<br><span style="color:#94a3b8;">humans, JS-tracked</span>')}
      ${statCell('Network clicks', String(cur.clicks), delta(cur.clicks, prev.clicks) + '<br><span style="color:#94a3b8;">incl. crawlers</span>')}
    </tr></table>
  </td></tr>
  <tr><td style="padding:8px 24px 24px;">
    <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">By network</div>
    <table width="100%" cellpadding="0" cellspacing="0">${networkRows}</table>
    <p style="margin:10px 0 0;font-size:12px;color:#94a3b8;">On-site clicks by link type: ${bucketLine}</p>

    ${rowsTable('Top teams (by commission, then clicks)', mergeRows(current.networks.map((n) => n.byTeam), 8))}
    ${rowsTable('By placement', mergeRows(current.networks.map((n) => n.byPlacement), 8))}

    <div style="margin-top:18px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#64748b;">Sales this week</div>
      ${salesTable(recentSales)}
    </div>

    <table cellpadding="0" cellspacing="0" style="margin:24px auto 0;"><tr><td style="background:#003087;border-radius:8px;">
      <a href="${SITE_URL}/admin/affiliates" style="display:inline-block;padding:11px 22px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">Open the Affiliates dashboard</a>
    </td></tr></table>
    <p style="margin:18px 0 0;font-size:11px;line-height:1.5;color:#94a3b8;text-align:center;">
      Fanatics pays 8% via Impact (30-day window); StubHub pays 4% via Partnerize (30-day cookie). Network clicks include search-engine crawlers following affiliate links; on-site clicks are the better read on real fans. Amazon has no reporting API and is not included.
    </p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

  return { subject, html };
}

export async function sendAffiliateWeeklySummary(): Promise<{ to: string; subject: string; id?: string }> {
  const data = await loadAffiliateWeeklyData();
  const { subject, html } = renderAffiliateWeeklyEmail(data);
  const res = await new Resend(process.env.RESEND_API_KEY).emails.send({
    from: FROM_EMAIL,
    to: AFFILIATE_REPORT_TO,
    subject,
    html,
  });
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return { to: AFFILIATE_REPORT_TO, subject, id: res.data?.id };
}
