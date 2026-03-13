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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 sm:gap-8">
            <h1
              className="text-2xl sm:text-3xl md:text-4xl font-bold text-white shrink-0"
              style={{ fontFamily: 'Bebas Neue, sans-serif' }}
            >
              Admin
            </h1>
            <nav className="flex gap-1">
              <Link
                href="/admin/analytics"
                className={`px-3 sm:px-4 py-2 rounded-t text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'analytics'
                    ? 'text-white border-b-2'
                    : 'text-white/60 hover:text-white/90'
                }`}
                style={activeTab === 'analytics' ? { borderBottomColor: '#FCB514' } : {}}
              >
                Analytics
              </Link>
              <Link
                href="/admin/posts"
                className={`px-3 sm:px-4 py-2 rounded-t text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'posts'
                    ? 'text-white border-b-2'
                    : 'text-white/60 hover:text-white/90'
                }`}
                style={activeTab === 'posts' ? { borderBottomColor: '#FCB514' } : {}}
              >
                Posts
              </Link>
              <Link
                href="/admin/outreach"
                className={`px-3 sm:px-4 py-2 rounded-t text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'outreach'
                    ? 'text-white border-b-2'
                    : 'text-white/60 hover:text-white/90'
                }`}
                style={activeTab === 'outreach' ? { borderBottomColor: '#FCB514' } : {}}
              >
                Outreach
              </Link>
              <Link
                href="/admin/newsletter"
                className={`px-3 sm:px-4 py-2 rounded-t text-xs sm:text-sm font-medium transition-colors ${
                  activeTab === 'newsletter'
                    ? 'text-white border-b-2'
                    : 'text-white/60 hover:text-white/90'
                }`}
                style={activeTab === 'newsletter' ? { borderBottomColor: '#FCB514' } : {}}
              >
                Newsletter
              </Link>
            </nav>
          </div>
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
      </div>
    </header>
  );
}
