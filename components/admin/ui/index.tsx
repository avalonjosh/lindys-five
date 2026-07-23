'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes, TextareaHTMLAttributes, CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react';

/**
 * Shared admin UI kit — light dashboard language. White surfaces on a gray-50
 * page, slate text ramp, Sabres blue (#003087) as the single accent. Every
 * admin section builds from these primitives; no hand-rolled inputs/modals.
 */

export const ACCENT = '#003087';

// ---------- Card ----------

export function Card({
  children,
  className = '',
  padding = true,
}: {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}) {
  return (
    <div className={`bg-white border border-gray-200 rounded-xl shadow-sm ${padding ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

// ---------- Page header ----------

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Section heading ----------

export function SectionHeading({
  children,
  actions,
  className = '',
}: {
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  /** Deprecated (old dark kit); ignored. Removed once all dashboards are rebuilt. */
  accent?: string;
}) {
  return (
    <div className={`mb-4 flex items-center justify-between gap-3 border-b border-gray-100 pb-2 ${className}`}>
      <h3 className="text-base font-bold text-gray-900">{children}</h3>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

// ---------- Button (renders <a> when href is given) ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-sabres-blue hover:bg-sabres-blue/90 text-white',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  ghost: 'text-gray-600 hover:text-gray-900 hover:bg-gray-100',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  href,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  href?: string;
}) {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm';
  const cls = `inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${BUTTON_VARIANTS[variant]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} {...props}>
      {children}
    </button>
  );
}

// ---------- Form controls (one recipe) ----------

const CONTROL =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-sabres-blue focus:ring-1 focus:ring-sabres-blue/30 disabled:bg-gray-50 disabled:text-gray-400';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${CONTROL} ${className}`} {...props} />;
}

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={`${CONTROL} ${className}`} {...props} />;
}

export function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`${CONTROL} ${className}`} {...props}>
      {children}
    </select>
  );
}

export function SearchInput({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={`relative ${className}`}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
      <input type="search" className={`${CONTROL} pl-9`} {...props} />
    </div>
  );
}

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  );
}

// ---------- Toggle ----------

export function Toggle({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  busy?: boolean;
  label?: ReactNode;
}) {
  const control = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled || busy}
      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-green-600' : 'bg-gray-300'
      } ${busy ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
    >
      <span
        className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );

  if (!label) return control;
  return (
    <label className="flex cursor-pointer items-center gap-3">
      {control}
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ---------- Badge ----------

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'accent';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  success: 'bg-green-50 text-green-700',
  warning: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-600',
  info: 'bg-indigo-50 text-indigo-600',
  neutral: 'bg-gray-100 text-gray-600',
  accent: 'bg-blue-50 text-sabres-blue',
};

export function Badge({
  variant = 'neutral',
  children,
  title,
  className = '',
  style,
}: {
  variant?: BadgeVariant;
  children: ReactNode;
  title?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded px-2 py-0.5 text-xs font-semibold ${BADGE_VARIANTS[variant]} ${className}`}
      title={title}
      style={style}
    >
      {children}
    </span>
  );
}

// ---------- Spinner ----------

export function Spinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'h-4 w-4 border-2', md: 'h-6 w-6 border-2', lg: 'h-10 w-10 border-4' };
  return (
    <div className={`animate-spin rounded-full border-gray-200 border-t-sabres-blue ${sizes[size]} ${className}`} />
  );
}

// ---------- Stat card (with honest delta) ----------

export function StatCard({
  label,
  value,
  sub,
  delta,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  /** Signed change with an explicit comparison label, e.g. { value: 12, label: 'vs previous 7 days' } */
  delta?: { value: number; label: string; format?: (n: number) => string };
  icon?: ReactNode;
}) {
  const fmt = delta?.format ?? ((n: number) => `${n > 0 ? '+' : ''}${n}`);
  return (
    <Card className="flex items-start justify-between gap-3" padding={false}>
      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-1 truncate text-2xl font-bold text-gray-900 sm:text-3xl">{value}</p>
        {delta && delta.value !== 0 && (
          <p className={`mt-1 flex items-center gap-1 text-xs font-semibold ${delta.value > 0 ? 'text-green-600' : 'text-red-500'}`}>
            {delta.value > 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {fmt(delta.value)} <span className="font-normal text-gray-400">{delta.label}</span>
          </p>
        )}
        {sub && <p className="mt-1 text-xs text-gray-400">{sub}</p>}
      </div>
      {icon && <div className="p-4 text-gray-300 sm:p-5">{icon}</div>}
    </Card>
  );
}

// ---------- Segmented control (one style for all range/tab pickers) ----------

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = '',
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`inline-flex rounded-lg bg-gray-100 p-1 ${className}`}>
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
            value === o.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// ---------- Table ----------

export function Table({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  className = '',
  align = 'left',
  sort,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  /** Makes the header sortable: current direction (null = unsorted) + click handler. */
  sort?: { direction: 'asc' | 'desc' | null; onClick: () => void };
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const inner = (
    <span className={`inline-flex items-center gap-1 ${sort ? 'cursor-pointer select-none hover:text-gray-700' : ''}`}>
      {children}
      {sort?.direction === 'asc' && <ArrowUp className="h-3 w-3" />}
      {sort?.direction === 'desc' && <ArrowDown className="h-3 w-3" />}
    </span>
  );
  return (
    <th className={`whitespace-nowrap border-b border-gray-200 bg-gray-50 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 ${alignCls} ${className}`}>
      {sort ? (
        <button type="button" onClick={sort.onClick} className="uppercase tracking-wide">
          {inner}
        </button>
      ) : (
        inner
      )}
    </th>
  );
}

export function Td({
  children,
  className = '',
  align = 'left',
  colSpan,
}: {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}) {
  const alignCls = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td colSpan={colSpan} className={`border-b border-gray-100 px-3 py-2.5 text-gray-700 ${alignCls} ${className}`}>
      {children}
    </td>
  );
}

// ---------- Modal (one backdrop, one behavior) ----------

export function Modal({
  onClose,
  title,
  children,
  wide = false,
}: {
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" aria-label="Close" onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className={`relative max-h-[90vh] w-full overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6 ${wide ? 'max-w-2xl' : 'max-w-md'}`}>
        <div className="mb-3 flex items-start justify-between gap-3">
          {title && <h3 className="text-lg font-bold text-gray-900">{title}</h3>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mr-1 flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Banners & empty state ----------

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{children}</div>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{children}</div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className="py-10 text-center text-sm text-gray-400">{children}</div>;
}

// ---------- Toast ----------

interface ToastItem {
  id: number;
  message: ReactNode;
  tone: 'success' | 'error' | 'info';
}

const ToastContext = createContext<{ toast: (message: ReactNode, tone?: ToastItem['tone']) => void }>({
  toast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: ReactNode, tone: ToastItem['tone'] = 'success') => {
    const id = Date.now() + Math.random();
    setItems(prev => [...prev, { id, message, tone }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col gap-2">
        {items.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-lg ${
              t.tone === 'success' ? 'bg-gray-900' : t.tone === 'error' ? 'bg-red-600' : 'bg-sabres-blue'
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
