'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface BlogNavProps {
  variant?: 'light' | 'dark';
}

export default function BlogNav({ variant = 'light' }: BlogNavProps) {
  const currentPath = usePathname();

  const tabs = [
    { path: '/blog', label: 'All Posts', exact: true },
    { path: '/blog/sabres', label: 'Sabres', exact: false },
    { path: '/blog/bills', label: 'Bills', exact: false },
  ];

  const isActive = (tab: typeof tabs[0]) => {
    if (tab.exact) {
      return currentPath === tab.path;
    }
    return currentPath.startsWith(tab.path);
  };

  // White text on blue background
  if (variant === 'dark') {
    return (
      <nav className="flex gap-8">
        {tabs.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.path}
              href={tab.path}
              className={`text-lg font-semibold pb-2 transition-colors ${
                active
                  ? 'text-white'
                  : 'text-white/70 hover:text-white border-b-2 border-transparent'
              }`}
              style={{
                fontFamily: 'Bebas Neue, sans-serif',
                borderBottom: active ? '3px solid #FFB81C' : undefined,
              }}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  // Dark text on light background (default)
  return (
    <nav className="flex gap-8">
      {tabs.map((tab) => {
        const active = isActive(tab);
        return (
          <Link
            key={tab.path}
            href={tab.path}
            className={`text-lg font-semibold pb-2 transition-colors ${
              active
                ? 'text-gray-900'
                : 'text-gray-400 hover:text-gray-900 border-b-2 border-transparent'
            }`}
            style={{
              fontFamily: 'Bebas Neue, sans-serif',
              borderBottom: active ? '3px solid #003087' : undefined,
            }}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
