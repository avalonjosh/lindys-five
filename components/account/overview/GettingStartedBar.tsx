'use client';

import Link from 'next/link';
import { X } from 'lucide-react';

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
  action: string;
  href?: string;
  onClick?: () => void;
}

/** One line: how many setup steps are done, and the next one to do. */
export default function GettingStartedBar({ items, onHide }: { items: ChecklistItem[]; onHide: () => void }) {
  const done = items.filter(i => i.done).length;
  const next = items.find(i => !i.done);
  if (!next) return null;
  const action = 'shrink-0 rounded-lg bg-amber-400 px-4 py-2 text-xs font-extrabold text-slate-900 transition-opacity hover:opacity-90';
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-3 py-3 sm:px-4">
      <span className="shrink-0 text-3xl leading-none text-amber-400" style={{ fontFamily: 'Bebas Neue, sans-serif' }} aria-label={`${done} of ${items.length} setup steps done`}>
        {done}/{items.length}
      </span>
      <p className="min-w-0 flex-1 text-sm text-slate-200">
        <span className="font-bold text-white">Next step:</span> {next.label}
      </p>
      {next.href ? (
        <Link href={next.href} className={action}>{next.action}</Link>
      ) : (
        <button type="button" onClick={next.onClick} className={action}>{next.action}</button>
      )}
      <button type="button" onClick={onHide} aria-label="Hide setup steps" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
