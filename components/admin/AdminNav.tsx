'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LogOut, ExternalLink } from 'lucide-react';
import { logout } from '@/lib/utils/auth';

interface AdminNavProps {
  activeTab: 'analytics' | 'posts' | 'outreach' | 'newsletter';
}

export default function AdminNav({ activeTab }: AdminNavProps) {
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.push('/admin/login');
  };

  return (
    <header
      className="shadow-xl border-b-4"
      style={{ background: '#003087', borderBottomColor: '#0A1128' }}
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3">
        {/* Top row: title + actions */}
        <div className="flex items-center justify-between">
          <h1
            className="text-2xl sm:text-3xl md:text-4xl font-bold text-white shrink-0"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Admin
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
                  ? 'text-white border-b-2'
                  : 'text-white/60 hover:text-white/90'
              }`}
              style={activeTab === tab.key ? { borderBottomColor: '#FCB514' } : {}}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
