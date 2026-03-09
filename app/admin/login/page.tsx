'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle } from 'lucide-react';
import { login } from '@/lib/utils/auth';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1
            className="text-4xl font-bold text-white mb-2"
            style={{ fontFamily: 'Bebas Neue, sans-serif' }}
          >
            Admin Login
          </h1>
          <p className="text-gray-400">Lindy&apos;s Five Blog Management</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-gradient-to-br from-[#002654] to-[#001a3d] rounded-2xl p-8 shadow-2xl border-2 border-[#FCB514]"
        >
          {error && (
            <div className="flex items-center gap-2 bg-red-900/30 border border-red-500/50 text-red-300 px-4 py-3 rounded-lg mb-6">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          <div className="mb-6">
            <label
              htmlFor="password"
              className="block text-sm font-semibold text-gray-300 mb-2"
            >
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-black/30 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-[#FCB514] transition-colors"
                placeholder="Enter admin password"
                required
                autoFocus
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full py-3 px-4 rounded-lg font-semibold text-black transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: '#FCB514',
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-black/30 border-t-black"></div>
                Logging in...
              </span>
            ) : (
              'Login'
            )}
          </button>
        </form>

        <p className="text-center text-gray-500 text-sm mt-6">
          <a href="/blog" className="text-[#FCB514] hover:underline">
            &larr; Back to Blog
          </a>
        </p>
      </div>
    </div>
  );
}
