'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function ScoresError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Scores page error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center">
        <h1 className="text-lg font-bold text-gray-900 mb-2">
          Something went wrong loading scores
        </h1>
        <p className="text-sm text-gray-600 mb-5">
          We hit an unexpected error. Try again, or head back to the scores list.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
          >
            Try again
          </button>
          <Link
            href="/nhl/scores"
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Back to scores
          </Link>
        </div>
      </div>
    </div>
  );
}
