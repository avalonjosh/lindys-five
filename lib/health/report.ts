/**
 * Runs the health checks, saves the latest results for the admin Overview, and
 * emails the owner when something fails (plus an all-clear summary on Mondays).
 */

import { kv } from '@vercel/kv';
import { Resend } from 'resend';
import { runHealthChecks, type CheckResult } from './checks';

export const HEALTH_LAST_KEY = 'health:last';
const FROM_EMAIL = "Lindy's Five <noreply@lindysfive.com>";
const SITE = 'https://www.lindysfive.com';
export const HEALTH_REPORT_TO = process.env.HEALTH_REPORT_EMAIL || process.env.AFFILIATE_REPORT_EMAIL || 'avalonjosh@gmail.com';

export interface HealthReport {
  at: string;
  results: CheckResult[];
  counts: Record<CheckResult['status'], number>;
}

export async function runAndStoreHealthReport(): Promise<HealthReport> {
  const results = await runHealthChecks();
  const counts = { ok: 0, warn: 0, fail: 0, skip: 0 };
  for (const r of results) counts[r.status]++;
  const report: HealthReport = { at: new Date().toISOString(), results, counts };
  await kv.set(HEALTH_LAST_KEY, report);
  return report;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function renderHealthEmail(report: HealthReport): { subject: string; html: string } {
  const { fail, warn } = report.counts;
  const subject = fail > 0
    ? `Site health: ${fail} problem${fail === 1 ? '' : 's'} need${fail === 1 ? 's' : ''} attention`
    : warn > 0
      ? `Site health: all working, ${warn} warning${warn === 1 ? '' : 's'}`
      : 'Site health: everything working';
  const color = { fail: '#dc2626', warn: '#d97706', ok: '#16a34a', skip: '#94a3b8' } as const;
  const label = { fail: 'PROBLEM', warn: 'WARNING', ok: 'OK', skip: 'SKIPPED' } as const;
  const order = ['fail', 'warn', 'ok', 'skip'] as const;
  const rows = [...report.results]
    .sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))
    .map((r) => `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;white-space:nowrap;font-size:11px;font-weight:700;color:${color[r.status]}">${label[r.status]}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;vertical-align:top;font-size:13px;color:#0f172a"><strong>${esc(r.label)}</strong><br/><span style="color:#475569">${esc(r.detail)}</span></td>
    </tr>`).join('');
  const html = `<!DOCTYPE html><html><body style="margin:0;padding:20px;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<table cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden">
  <tr><td style="background:#0f172a;padding:16px 20px;color:#ffffff;font-size:18px;font-weight:700">${esc(subject)}</td></tr>
  <tr><td style="padding:14px 20px 4px;font-size:13px;color:#475569">${report.counts.ok} OK · ${warn} warnings · ${fail} problems · ${report.counts.skip} skipped. Checked ${new Date(report.at).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET.</td></tr>
  <tr><td style="padding:8px 10px 16px"><table cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr>
  <tr><td style="padding:0 20px 20px;font-size:12px;color:#64748b">Details and a Run now button: <a href="${SITE}/admin" style="color:#003087">${SITE}/admin</a></td></tr>
</table></body></html>`;
  return { subject, html };
}

export async function sendHealthEmail(report: HealthReport): Promise<string | undefined> {
  const { subject, html } = renderHealthEmail(report);
  const res = await new Resend(process.env.RESEND_API_KEY).emails.send({ from: FROM_EMAIL, to: HEALTH_REPORT_TO, subject, html });
  if (res.error) throw new Error(`Resend: ${res.error.message}`);
  return res.data?.id;
}
