'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, ExternalLink } from 'lucide-react';
import { logout } from '@/lib/utils/auth';

type AdminTab = 'analytics' | 'posts' | 'outreach' | 'newsletter';

export default function AdminNav() {
  const router = useRouter();
  const pathname = usePathname();

  const activeTab: AdminTab | null = pathname?.startsWith('/admin/analytics')
    ? 'analytics'
    : pathname?.startsWith('/admin/posts')
    ? 'posts'
    : pathname?.startsWith('/admin/outreach')
    ? 'outreach'
    : pathname?.startsWith('/admin/newsletter')
    ? 'newsletter'
    : null;

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <header className="shadow-xl border-b-4 bg-sabres-blue border-b-sabres-navy">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl sm:text-3xl md:text-4xl text-white shrink-0">
            Lindy&apos;s Five Admin
          </h1>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/"
              className="text-white/70 hover:text-white text-sm transition-colors"
              title="View Site"
            >
              <span className="hidden sm:inline">View Site</span>
              <ExternalLink className="w-4 h-4 sm:hidden" />
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-white/70 hover:text-white text-sm transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
        {/* Tab row: full width, evenly distributed */}
        <nav className="flex mt-2">
          {([
            { key: 'analytics', label: 'Analytics', href: '/admin/analytics' },
            { key: 'posts', label: 'Posts', href: '/admin/posts' },
            { key: 'outreach', label: 'Outreach', href: '/admin/outreach' },
            { key: 'newsletter', label: 'Newsletter', href: '/admin/newsletter' },
          ] as const).map(tab => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`flex-1 text-center py-2 text-xs sm:text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'text-white border-b-2 border-b-sabres-gold'
                  : 'text-white/60 hover:text-white/90'
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
