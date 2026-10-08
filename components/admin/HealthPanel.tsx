'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, RefreshCw, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Card, Button } from './ui';
import type { HealthReport } from '@/lib/health/report';
import type { CheckResult } from '@/lib/health/checks';

const STATUS_STYLE: Record<CheckResult['status'], { label: string; cls: string }> = {
  fail: { label: 'Problem', cls: 'bg-red-50 text-red-700' },
  warn: { label: 'Warning', cls: 'bg-amber-50 text-amber-700' },
  ok: { label: 'OK', cls: 'bg-green-50 text-green-700' },
  skip: { label: 'Skipped', cls: 'bg-gray-100 text-gray-500' },
};
const ORDER: CheckResult['status'][] = ['fail', 'warn', 'ok', 'skip'];

/** Daily site health check results, with problems and warnings listed up front. */
export default function HealthPanel() {
  const [report, setReport] = useState<HealthReport | null | undefined>(undefined);
  const [running, setRunning] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetch('/api/admin/health', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then(setReport)
      .catch(() => setReport(null));
  }, []);

  const runNow = async () => {
    setRunning(true);
    try {
      const r = await fetch('/api/admin/health', { method: 'POST', credentials: 'include' });
      if (r.ok) setReport(await r.json());
    } finally {
      setRunning(false);
    }
  };

  const results = report ? [...report.results].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) : [];
  const flagged = results.filter((r) => r.status === 'fail' || r.status === 'warn');
  const shown = showAll ? results : flagged;
  const fails = report?.counts.fail ?? 0;
  const warns = report?.counts.warn ?? 0;
  const healthy = report && fails === 0;

  return (
    <Card className="mb-6" padding={false}>
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          {report && !healthy
            ? <ShieldAlert className="h-6 w-6 shrink-0 text-red-600" />
            : <ShieldCheck className={`h-6 w-6 shrink-0 ${report ? 'text-green-600' : 'text-gray-300'}`} />}
          <div className="min-w-0">
            <p className="font-bold text-gray-900">
              {report === undefined ? 'Site health' : report === null ? 'Site health: not checked yet'
                : fails > 0 ? `Site health: ${fails} problem${fails === 1 ? '' : 's'}`
                : `Site health: all working${warns ? `, ${warns} warning${warns === 1 ? '' : 's'}` : ''}`}
            </p>
            <p className="text-xs text-gray-500">
              {report
                ? `${report.counts.ok} OK · ${warns} warnings · ${fails} problems · checked ${new Date(report.at).toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} ET. Runs daily at 11:30am ET; emails you on problems and every Monday.`
                : 'Runs daily at 11:30am ET; emails you on problems and every Monday.'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {report && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll ? <>Hide passing <ChevronUp className="h-4 w-4" /></> : <>All {results.length} checks <ChevronDown className="h-4 w-4" /></>}
            </Button>
          )}
          <Button variant="secondary" size="sm" onClick={runNow} disabled={running}>
            <RefreshCw className={`h-4 w-4 ${running ? 'animate-spin' : ''}`} /> {running ? 'Checking…' : 'Run now'}
          </Button>
        </div>
      </div>
      {shown.length > 0 && (
        <ul className="divide-y divide-gray-100 border-t border-gray-100">
          {shown.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-4 py-2.5 sm:px-5">
              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${STATUS_STYLE[r.status].cls}`}>{STATUS_STYLE[r.status].label}</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900">{r.label} <span className="font-normal text-gray-400">· {r.area}</span></p>
                <p className="text-xs text-gray-600">{r.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
