'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle } from 'lucide-react';
import { login } from '@/lib/utils/auth';
import { Card, Button } from '@/components/admin/ui';

export default function AdminLoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await login(password);

    if (result.success) {
      router.push('/admin/posts');
    } else {
      setError(result.error || 'Login failed');
      setPassword('');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="font-display text-3xl text-white tracking-wide mb-2">
            Lindy&apos;s Five Admin
          </h1>
          <p className="text-slate-400">Sign in to manage the site</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
                <AlertCircle className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="mb-6">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-slate-300 mb-2"
              >
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sabres-gold transition-colors"
                  placeholder="Enter admin password"
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading || !password}
              className="w-full"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-black/30 border-t-black" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </Card>

        <p className="text-center text-slate-500 text-sm mt-6">
          <a href="/blog" className="text-sabres-gold hover:underline">
            &larr; Back to Blog
          </a>
        </p>
      </div>
    </div>
  );
}
