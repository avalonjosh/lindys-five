'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, AlertCircle } from 'lucide-react';
import { login } from '@/lib/utils/auth';
import { Card, Button, Input } from '@/components/admin/ui';

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
      router.push('/admin');
    } else {
      setError(result.error || 'Login failed');
      setPassword('');
    }

    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="font-display mb-1 text-3xl tracking-wide text-sabres-blue">
            Lindy&apos;s Five
          </h1>
          <p className="text-sm text-gray-500">Sign in to manage the site</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-gray-700">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                  placeholder="Enter admin password"
                  required
                  autoFocus
                />
              </div>
            </div>

            <Button type="submit" variant="primary" disabled={loading || !password} className="w-full">
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Logging in...
                </>
              ) : (
                'Login'
              )}
            </Button>
          </form>
        </Card>

        <p className="mt-6 text-center text-sm text-gray-400">
          <a href="/" className="text-sabres-blue hover:underline">
            &larr; Back to Lindy&apos;s Five
          </a>
        </p>
      </div>
    </div>
  );
}
