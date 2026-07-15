import type { ReactNode, ButtonHTMLAttributes } from 'react';

/**
 * Shared admin UI kit. All admin sections use these primitives so the
 * dashboard has one visual language: dark slate surfaces, Sabres gold
 * accents, Bebas Neue display headings (the `font-display` utility).
 */

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
    <div className={`bg-slate-800 border border-slate-700 rounded-xl shadow-lg ${padding ? 'p-5 sm:p-6' : ''} ${className}`}>
      {children}
    </div>
  );
}

// ---------- Section heading ----------

export function SectionHeading({
  children,
  accent,
  className = '',
}: {
  children: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <h3
      className={`font-display text-2xl text-white tracking-wide mb-4 pb-2 border-b ${className}`}
      style={{ borderBottomColor: accent ? `${accent}55` : 'rgb(51 65 85)' }}
    >
      {children}
    </h3>
  );
}

// ---------- Button ----------

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-sabres-gold hover:brightness-110 text-black',
  secondary: 'bg-indigo-600 hover:bg-indigo-500 text-white',
  ghost: 'border border-slate-600 text-slate-300 hover:text-white hover:border-slate-400 bg-transparent',
  danger: 'bg-red-600 hover:bg-red-500 text-white',
  dark: 'bg-black hover:bg-zinc-900 text-white',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
}) {
  const sizeClasses = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2';
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses} ${BUTTON_VARIANTS[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
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
      disabled={disabled}
      className={`relative w-11 h-6 shrink-0 rounded-full transition-colors ${
        checked ? 'bg-green-600' : 'bg-slate-600'
      } ${busy ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
          checked ? 'translate-x-5' : ''
        }`}
      />
    </button>
  );

  if (!label) return control;
  return (
    <label className="flex items-center gap-3 cursor-pointer">
      {control}
      <span className="text-slate-300 text-sm">{label}</span>
    </label>
  );
}

// ---------- Badge ----------

type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  success: 'bg-green-600/20 text-green-400',
  warning: 'bg-amber-500/20 text-amber-400',
  error: 'bg-red-600/20 text-red-400',
  info: 'bg-indigo-500/20 text-indigo-300',
  neutral: 'bg-slate-600/40 text-slate-300',
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
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold whitespace-nowrap ${BADGE_VARIANTS[variant]} ${className}`}
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
    <div className={`animate-spin rounded-full border-slate-600 border-t-sabres-gold ${sizes[size]} ${className}`} />
  );
}

// ---------- Stat card ----------

export function StatCard({
  label,
  value,
  sub,
  icon,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Card className="flex items-start justify-between gap-3" padding={false}>
      <div className="p-4 sm:p-5 flex-1 min-w-0">
        <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold">{label}</p>
        <p className="text-white text-2xl sm:text-3xl font-bold mt-1 truncate">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
      {icon && <div className="p-4 sm:p-5 text-slate-500">{icon}</div>}
    </Card>
  );
}

// ---------- Empty / error banners ----------

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-xl text-red-300 text-sm">
      {children}
    </div>
  );
}

export function WarningBanner({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 bg-amber-900/30 border border-amber-500/50 rounded-xl text-amber-300 text-sm">
      {children}
    </div>
  );
}
