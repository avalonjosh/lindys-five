'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ExternalLink } from 'lucide-react';
import { logout } from '@/lib/utils/auth';

type AdminTab = 'overview' | 'posts' | 'subscribers' | 'analytics' | 'outreach';

const TABS: { key: AdminTab; label: string; href: string }[] = [
  { key: 'overview', label: 'Overview', href: '/admin' },
  { key: 'posts', label: 'Posts', href: '/admin/posts' },
  { key: 'subscribers', label: 'Subscribers', href: '/admin/subscribers' },
  { key: 'analytics', label: 'Analytics', href: '/admin/analytics' },
  { key: 'outreach', label: 'Outreach', href: '/admin/outreach' },
];

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: AdminTab = pathname?.startsWith('/admin/posts')
    ? 'posts'
    : pathname?.startsWith('/admin/subscribers') || pathname?.startsWith('/admin/newsletter')
    ? 'subscribers'
    : pathname?.startsWith('/admin/analytics')
    ? 'analytics'
    : pathname?.startsWith('/admin/outreach')
    ? 'outreach'
    : 'overview';

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-3 sm:px-4">
        <div className="flex items-center justify-between py-3">
          <Link href="/admin" className="flex items-baseline gap-2">
            <span className="font-display text-2xl tracking-wide text-sabres-blue">Lindy&apos;s Five</span>
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Admin</span>
          </Link>
          <div className="flex items-center gap-3 sm:gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
              title="View Site"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">View Site</span>
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900"
            >
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        <nav className="-mb-px flex gap-1 overflow-x-auto">
          {TABS.map(tab => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab.key
                  ? 'border-sabres-blue text-sabres-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
