import type { ReactNode } from 'react';

/** Bebas section heading used across the profile, same as the home page's. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <h2 className="text-2xl text-white sm:text-3xl" style={{ fontFamily: 'Bebas Neue, sans-serif' }}>{children}</h2>
      {right}
    </div>
  );
}
